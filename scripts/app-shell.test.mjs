import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = await readFile(join(root, 'index.html'), 'utf8');
const grid = html.match(/<div class="app-grid" id="phoneAppGrid">([\s\S]*?)<\/div>\s*<\/div>\s*<div id="tab-ai"/)?.[1];

test('phone app shell contains 22 app tiles with unique visible names', () => {
  assert.ok(grid, 'phone app grid should exist');
  const tiles = [...grid.matchAll(/<div class="app-item" onclick="launchNativeApp\('/g)];
  assert.equal(tiles.length, 22, 'expected 22 launchable app tiles');
  const names = [...grid.matchAll(/class="app-name">([^<]+)</g)].map(([, name]) => name.trim());
  assert.equal(names.length, tiles.length, 'every tile should have a visible app name');
  assert.ok(names.every(Boolean), 'every tile should have a non-empty visible app name');
  assert.equal(new Set(names).size, names.length, 'visible app names should be unique');
});

test('phone app tiles expose keyboard activation and accessible names', () => {
  assert.match(html, /tile\.setAttribute\('role', 'button'\)/);
  assert.match(html, /tile\.setAttribute\('tabindex', '0'\)/);
  assert.match(html, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(html, /tile\.setAttribute\('aria-label', 'Отвори ' \+ appName\)/);
});

test('app search reports visible results and a no-results state', () => {
  assert.match(html, /id="appSearch"/);
  assert.match(html, /id="appSearchStatus"/);
  assert.match(html, /id="appSearchEmpty"/);
  assert.match(html, /app\.hidden = !matches/);
  assert.match(html, /appSearchEmpty\.hidden = visible !== 0/);
});

test('app launch status does not falsely claim that Android confirmed launch', () => {
  assert.match(html, /Се обидувам да ја отворам апликацијата:/);
  assert.doesNotMatch(html, /Не се потврди отворање/);
});
