import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSportLifeText, processBulletin, reportToCsv, runScheduledJob } from './pluton-scheduled.mjs';

test('processes matches locally and assigns deterministic chief IDs', () => {
  const report = processBulletin(JSON.stringify({
    matches: [
      { matchId: 'M-1', homeTeam: 'FC Example', awayTeam: 'United Example', league: 'Demo', odds: { home: 1.8 } },
      { matchId: 'M-2', homeTeam: 'Real Sample', awayTeam: 'Sample City' },
    ],
  }), '2026-11-22T07:30:00.000Z');

  assert.equal(report.status, 'completed');
  assert.equal(report.mode, 'local-only / no provider API calls');
  assert.equal(report.counts.imported, 2);
  assert.equal(report.counts.valid, 2);
  assert.equal(report.tasks[0].chiefId, 'CHIEF-0001');
  assert.equal(report.tasks[0].odds.home, 1.8);
  assert.equal(report.tasks[0].ID.length, 32);
});

test('defaults to 400 logical chiefs and supports the configured 100/400/1000 options', () => {
  const matches = Array.from({ length: 471 }, (_, index) => ({
    matchId: 'M-' + index,
    homeTeam: 'Home ' + index,
    awayTeam: 'Away ' + index,
  }));
  const report = processBulletin(JSON.stringify({ matches }));
  assert.equal(report.counts.imported, 471);
  assert.equal(report.counts.assignedChiefs, 400);
  assert.equal(report.tasks[399].chiefId, 'CHIEF-0400');
  assert.equal(report.tasks[400].chiefId, 'CHIEF-0001');

  const smaller = processBulletin(JSON.stringify({ matches: matches.slice(0, 101) }), undefined, 100);
  assert.equal(smaller.counts.assignedChiefs, 100);
  const larger = processBulletin(JSON.stringify({ matches }), undefined, 1000);
  assert.equal(larger.counts.assignedChiefs, 471);
  assert.throws(() => processBulletin(JSON.stringify({ matches }), undefined, 500), /100, 400, or 1000/);
});

test('skips duplicate normalized matches and marks identical home/away teams invalid', () => {
  const report = processBulletin(JSON.stringify({ matches: [
    { matchId: 'M-1', homeTeam: 'FC ÁBC', awayTeam: 'United' },
    { matchId: 'm-1', homeTeam: 'fc abc', awayTeam: 'UNITED' },
    { matchId: 'M-2', homeTeam: 'Same Team', awayTeam: 'same-team' },
  ] }));

  assert.equal(report.counts.imported, 2);
  assert.equal(report.counts.skipped, 1);
  assert.equal(report.counts.failed, 1);
  assert.equal(report.tasks[1].valid, false);
  // A skipped duplicate must not consume a chief slot in the round-robin assignment.
  assert.equal(report.tasks[1].chiefId, 'CHIEF-0002');
});

test('rejects malformed or unsupported bulletin JSON', () => {
  assert.throws(() => processBulletin('{broken'), /not valid JSON/i);
  assert.throws(() => processBulletin(JSON.stringify({ items: [] })), /Expected a JSON array/i);
});

test('writes correctly escaped CSV values', () => {
  const report = processBulletin(JSON.stringify({ matches: [
    { matchId: 'M-1', homeTeam: 'Team, "A"', awayTeam: 'Team B' },
  ] }));
  const csv = reportToCsv(report);
  assert.match(csv, /"Team, ""A"""/);
  assert.match(csv.split('\r\n')[0], /^ID,matchId,homeTeam,awayTeam/);
});

test('parses raw SportLife text without treating kickoff times as matches', () => {
  const raw = [
    'England Premier League',
    'Arsenal : Chelsea',
    '18:00',
    '12345',
    'Конечен Тип 1.8 X3.2 4.2',
    'ГГ1.7 НГ2.0',
    '0-1 гол2.2 2+1.5',
  ].join('\n');
  const matches = parseSportLifeText(raw);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].homeTeam, 'Arsenal');
  assert.equal(matches[0].awayTeam, 'Chelsea');
  assert.equal(matches[0].matchId, '12345');
  assert.equal(matches[0].league, 'England Premier League');
  assert.equal(matches[0].odds.home, 1.8);
  assert.equal(matches[0].odds.draw, 3.2);
  assert.equal(matches[0].odds.away, 4.2);
});

test('honors 07:30 Europe/Skopje in both winter and summer UTC offsets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pluton-schedule-test-'));
  try {
    const missingInput = join(root, 'missing-bulletin.json');
    const summer = await runScheduledJob({
      inputPath: missingInput,
      outputDirectory: join(root, 'summer'),
      eventName: 'schedule',
      now: new Date('2026-06-02T05:30:00.000Z'),
    });
    const winter = await runScheduledJob({
      inputPath: missingInput,
      outputDirectory: join(root, 'winter'),
      eventName: 'schedule',
      now: new Date('2026-11-24T06:30:00.000Z'),
    });
    const wrongSlot = await runScheduledJob({
      inputPath: missingInput,
      outputDirectory: join(root, 'wrong-slot'),
      eventName: 'schedule',
      now: new Date('2026-06-02T06:30:00.000Z'),
    });

    assert.equal(summer.status, 'skipped_missing_bulletin');
    assert.equal(winter.status, 'skipped_missing_bulletin');
    assert.equal(wrongSlot.status, 'skipped_outside_local_schedule');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
