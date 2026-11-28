import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_RECORDS = 10000;
const DEFAULT_CHIEF_COUNT = 400;
const ALLOWED_CHIEF_COUNTS = new Set([100, 400, 1000]);
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

export function parseSportLifeText(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const matches = [];
  let league = 'Непозната Лига';
  let sport = 'Фудбал';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/Кошарка|Basketball/i.test(line)) sport = 'Кошарка';
    else if (/Ракомет|Handball/i.test(line)) sport = 'Ракомет';
    else if (/Тенис|Tennis/i.test(line)) sport = 'Тенис';
    else if (/Хокеј|Hockey/i.test(line)) sport = 'Хокеј';

    if (/^[A-Za-zА-Ша-ш\s.]+$/i.test(line) &&
        ['England', 'Spain', 'Italy', 'Germany', 'France', 'UEFA', 'League'].some(term => line.includes(term))) {
      league = line;
    }

    // Clock lines such as 18:00 are not team-vs-team records.
    if (/^\d{1,2}:\d{2}$/.test(line)) continue;
    const match = line.match(/(.+?)\s*:\s*(.+)/);
    if (!match) continue;

    const homeTeam = match[1].trim();
    const awayTeam = match[2].trim();
    if (!homeTeam || !awayTeam) continue;

    const block = lines.slice(i, Math.min(i + 60, lines.length)).join(' ');
    const finalOdds = block.match(/(?:Конечен Тип|Конечен исход)\s*([\d.]+)(?:\s*X([\d.]+))?\s*([\d.]+)/);
    if (!finalOdds) continue;

    const ggNg = block.match(/ГГ([\d.]+)\s*НГ([\d.]+)/);
    const goals = block.match(/0-1 гол([\d.]+)\s*2\+([\d.]+)/);
    const time = lines[i + 1] ? lines[i + 1].trim() : '';
    const code = lines[i + 2] ? lines[i + 2].trim() : '';

    matches.push({
      matchId: code || 'MATCH-' + String(matches.length + 1).padStart(4, '0'),
      homeTeam,
      awayTeam,
      sport,
      league,
      liga: league,
      vreme: time,
      sifra: code,
      odds: {
        home: Number.parseFloat(finalOdds[1]),
        draw: finalOdds[2] ? Number.parseFloat(finalOdds[2]) : 0,
        away: Number.parseFloat(finalOdds[3]),
        gg: ggNg ? Number.parseFloat(ggNg[1]) : 0,
        ng: ggNg ? Number.parseFloat(ggNg[2]) : 0,
        tg2plus: goals ? Number.parseFloat(goals[2]) : 0,
      },
    });
  }

  return matches;
}

function stableId(matchId, homeNormalized, awayNormalized) {
  return createHash('sha256')
    .update(matchId.toLocaleLowerCase() + '|' + homeNormalized + '|' + awayNormalized)
    .digest('hex')
    .slice(0, 32);
}

export function processBulletin(input, generatedAt = new Date().toISOString(), chiefCount = Number(process.env.PLUTON_CHIEF_COUNT || DEFAULT_CHIEF_COUNT)) {
  if (!ALLOWED_CHIEF_COUNTS.has(chiefCount)) throw new Error('Chief count must be 100, 400, or 1000.');
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
      chiefId: 'CHIEF-' + String((tasks.length % chiefCount) + 1).padStart(4, '0'),
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
  chiefCount = Number(process.env.PLUTON_CHIEF_COUNT || DEFAULT_CHIEF_COUNT),
} = {}) {
  const generatedAt = now.toISOString();

  // GitHub scheduled events can be delayed by queueing or service load.
  // The workflow cron defines Tue/Fri; do not silently discard a valid run
  // just because it starts outside the nominal 07:00 Europe/Skopje hour.

  let raw;
  let sourcePath = inputPath;
  try {
    raw = await readFile(sourcePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT' && sourcePath === 'data/bulletin.json') {
      sourcePath = 'data/bulletin.txt';
      try {
        raw = await readFile(sourcePath, 'utf8');
      } catch (fallbackError) {
        if (fallbackError && fallbackError.code === 'ENOENT') {
          const report = skippedReport(
            'skipped_missing_bulletin',
            'No source file at data/bulletin.json or data/bulletin.txt. Add/update a real JSON or raw SportLife text bulletin.',
            generatedAt,
          );
          await writeOutputs(report, outputDirectory);
          return report;
        }
        throw fallbackError;
      }
    } else if (error && error.code === 'ENOENT') {
      const report = skippedReport(
        'skipped_missing_bulletin',
        'No source file at ' + sourcePath + '. Add/update a real JSON or raw SportLife text bulletin.',
        generatedAt,
      );
      await writeOutputs(report, outputDirectory);
      return report;
    } else {
      throw error;
    }
  }

  let report;
  if (/\.(txt|text)$/i.test(sourcePath)) {
    const matches = parseSportLifeText(raw);
    if (!matches.length) throw new Error('No matches recognized in the raw SportLife text. Check the source format and final-odds blocks.');
    report = processBulletin(JSON.stringify({ matches }), generatedAt, chiefCount);
    report.inputFormat = 'sportlife-text';
  } else {
    report = processBulletin(raw, generatedAt, chiefCount);
    report.inputFormat = 'json';
  }
  report.source = sourcePath;
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
