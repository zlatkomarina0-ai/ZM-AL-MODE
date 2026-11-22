import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_RECORDS = 10000;
const CHIEF_COUNT = 1000;
const TIME_ZONE = 'Europe/Skopje';
const CSV_COLUMNS = [
  'ID', 'matchId', 'homeTeam', 'awayTeam', 'chiefId', 'status', 'attempts',
  'valid', 'errors', 'error', 'sport', 'league', 'liga', 'vreme', 'sifra',
  'odds', 'homeNormalized', 'awayNormalized', 'createdAt', 'updatedAt',
];

export function normalizeTeamName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stableId(matchId, homeNormalized, awayNormalized) {
  return createHash('sha256')
    .update(matchId.toLocaleLowerCase() + '|' + homeNormalized + '|' + awayNormalized)
    .digest('hex')
    .slice(0, 32);
}

export function processBulletin(input, generatedAt = new Date().toISOString()) {
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (error) {
    throw new Error('Bulletin is not valid JSON: ' + (error instanceof Error ? error.message : 'parse error'));
  }

  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray(parsed.matches)
      ? parsed.matches
      : [];

  if (!records.length) throw new Error('Expected a JSON array or an object containing a non-empty "matches" array.');
  if (records.length > MAX_RECORDS) throw new Error('Bulletin exceeds the 10,000-record limit.');

  const seen = new Set();
  const tasks = [];
  let skipped = 0;

  records.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped += 1;
      return;
    }

    const homeTeam = typeof item.homeTeam === 'string' ? item.homeTeam.trim() : '';
    const awayTeam = typeof item.awayTeam === 'string' ? item.awayTeam.trim() : '';
    if (!homeTeam || !awayTeam) {
      skipped += 1;
      return;
    }

    const matchId = typeof item.matchId === 'string' && item.matchId.trim()
      ? item.matchId.trim()
      : typeof item.sifra === 'string' && item.sifra.trim()
        ? item.sifra.trim()
        : 'MATCH-' + String(index + 1).padStart(4, '0');

    const homeNormalized = normalizeTeamName(homeTeam);
    const awayNormalized = normalizeTeamName(awayTeam);
    const key = matchId.toLocaleLowerCase() + '|' + homeNormalized + '|' + awayNormalized;
    if (seen.has(key)) {
      skipped += 1;
      return;
    }
    seen.add(key);

    const errors = [];
    if (homeNormalized === awayNormalized) errors.push('Home and away teams resolve to the same normalized name.');

    const valid = errors.length === 0;
    const id = stableId(matchId, homeNormalized, awayNormalized);
    tasks.push({
      ID: id,
      matchId,
      homeTeam,
      awayTeam,
      chiefId: 'CHIEF-' + String((index % CHIEF_COUNT) + 1).padStart(4, '0'),
      status: valid ? 'done' : 'failed',
      attempts: 1,
      valid,
      errors,
      error: errors.join('; '),
      sport: item.sport ?? '',
      league: item.league ?? '',
      liga: item.liga ?? '',
      vreme: item.vreme ?? '',
      sifra: item.sifra ?? '',
      odds: item.odds ?? '',
      homeNormalized,
      awayNormalized,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
  });

  const counts = {
    totalRecords: records.length,
    imported: tasks.length,
    valid: tasks.filter(task => task.valid).length,
    failed: tasks.filter(task => !task.valid).length,
    skipped,
    assignedChiefs: new Set(tasks.map(task => task.chiefId)).size,
  };

  return {
    system: 'ZLATKO AI MODE',
    engine: 'PLUTON CODE ♠',
    version: 'scheduled-local-1.0',
    mode: 'local-only / no provider API calls',
    status: 'completed',
    timeZone: TIME_ZONE,
    generatedAt,
    counts,
    tasks,
  };
}

function csvCell(value) {
  const text = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  return '"' + text.replace(/\r?\n/g, ' ').replace(/"/g, '""') + '"';
}

export function reportToCsv(report) {
  const rows = report.tasks ?? [];
  return [
    CSV_COLUMNS.join(','),
    ...rows.map(task => CSV_COLUMNS.map(column => csvCell(task[column])).join(',')),
  ].join('\r\n');
}

function localScheduleParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function skippedReport(status, message, generatedAt) {
  return {
    system: 'ZLATKO AI MODE',
    engine: 'PLUTON CODE ♠',
    version: 'scheduled-local-1.0',
    mode: 'local-only / no provider API calls',
    status,
    timeZone: TIME_ZONE,
    generatedAt,
    message,
    counts: { totalRecords: 0, imported: 0, valid: 0, failed: 0, skipped: 0, assignedChiefs: 0 },
    tasks: [],
  };
}

async function writeOutputs(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'pluton-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(resolve(outputDirectory, 'pluton-report.csv'), reportToCsv(report) + '\n', 'utf8');
}

export async function runScheduledJob({
  inputPath = process.env.PLUTON_BULLETIN_PATH || 'data/bulletin.json',
  outputDirectory = process.env.PLUTON_OUTPUT_DIR || 'artifacts',
  eventName = process.env.GITHUB_EVENT_NAME || 'manual',
  now = new Date(),
} = {}) {
  const generatedAt = now.toISOString();

  if (eventName === 'schedule') {
    const local = localScheduleParts(now);
    if (!['Tue', 'Fri'].includes(local.weekday) || Number(local.hour) !== 7) {
      const report = skippedReport(
        'skipped_outside_local_schedule',
        'GitHub cron fired outside the 07:00–07:59 Europe/Skopje window; no bulletin was processed.',
        generatedAt,
      );
      await writeOutputs(report, outputDirectory);
      return report;
    }
  }

  let raw;
  try {
    raw = await readFile(inputPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const report = skippedReport(
        'skipped_missing_bulletin',
        'No source file at ' + inputPath + '. Add/update the JSON bulletin file to enable scheduled processing.',
        generatedAt,
      );
      await writeOutputs(report, outputDirectory);
      return report;
    }
    throw error;
  }

  const report = processBulletin(raw, generatedAt);
  await writeOutputs(report, outputDirectory);
  return report;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runScheduledJob()
    .then(report => {
      console.log(JSON.stringify({ status: report.status, counts: report.counts, message: report.message ?? '' }, null, 2));
      if (report.status === 'failed') process.exitCode = 1;
    })
    .catch(async error => {
      const generatedAt = new Date().toISOString();
      const report = skippedReport(
        'failed',
        error instanceof Error ? error.message : 'Unknown scheduled processing error.',
        generatedAt,
      );
      await writeOutputs(report, process.env.PLUTON_OUTPUT_DIR || 'artifacts');
      console.error(report.message);
      process.exitCode = 1;
    });
}
