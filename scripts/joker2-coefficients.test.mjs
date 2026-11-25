import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOKER2_BANDS,
  JOKER2_TOTAL_PLANNED_WORKERS,
  classifyCoefficient,
  countJoker2Bands,
  scanMatchCoefficients,
} from '../src/pluton-joker2.ts';

test('defines five non-overlapping coefficient bands and the planned target', () => {
  assert.equal(JOKER2_BANDS.length, 5);
  assert.equal(JOKER2_TOTAL_PLANNED_WORKERS, 2_500_000);
  assert.deepEqual(JOKER2_BANDS.map(band => band.plannedWorkers), [
    500_000, 500_000, 500_000, 500_000, 500_000,
  ]);
});

test('classifies every boundary without overlap', () => {
  assert.equal(classifyCoefficient(1.99), null);
  assert.equal(classifyCoefficient(2)?.id, '2-5');
  assert.equal(classifyCoefficient(4.999)?.id, '2-5');
  assert.equal(classifyCoefficient(5)?.id, '5-10');
  assert.equal(classifyCoefficient(9.999)?.id, '5-10');
  assert.equal(classifyCoefficient(10)?.id, '10-20');
  assert.equal(classifyCoefficient(19.999)?.id, '10-20');
  assert.equal(classifyCoefficient(20)?.id, '20-30');
  assert.equal(classifyCoefficient(30)?.id, '20-30');
  assert.equal(classifyCoefficient(30.001)?.id, '30-plus');
  assert.equal(classifyCoefficient(1000)?.id, '30-plus');
});

test('rejects non-finite and non-numeric coefficient values', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -5]) {
    assert.equal(classifyCoefficient(value), null);
  }
});

test('scans supported match fields and numeric-string odds while ignoring malformed rows', () => {
  const rows = scanMatchCoefficients([
    {
      matchId: 'M-1',
      homeTeam: 'Alpha',
      awayTeam: 'Beta',
      odds: { home: 2, draw: '5.0', away: '30', invalid: 'not odds', empty: '' },
    },
    { sifra: 'M-2', domakin: 'Gamma', gosti: 'Delta', odds: { home: 31 } },
    { matchId: 'M-3', homeTeam: 'No odds', awayTeam: 'Here', odds: null },
    null,
    ['not', 'a', 'match'],
    { matchId: 'M-4', odds: { home: 8 } },
  ]);

  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map(row => row.bandId), ['2-5', '5-10', '20-30', '30-plus']);
  assert.equal(rows[1].coefficient, 5);
  assert.equal(rows[3].matchId, 'M-2');
  assert.equal(rows[3].homeTeam, 'Gamma');
  assert.equal(rows[3].awayTeam, 'Delta');
});

test('counts each band and returns zero for empty bands', () => {
  const rows = scanMatchCoefficients([
    { matchId: 'M-1', homeTeam: 'A', awayTeam: 'B', odds: { home: 2, draw: 3, away: 5, over: 10, under: 20, special: 31 } },
  ]);
  assert.deepEqual(countJoker2Bands(rows), {
    '2-5': 2,
    '5-10': 1,
    '10-20': 1,
    '20-30': 1,
    '30-plus': 1,
  });
  assert.deepEqual(countJoker2Bands([]), {
    '2-5': 0,
    '5-10': 0,
    '10-20': 0,
    '20-30': 0,
    '30-plus': 0,
  });
});
