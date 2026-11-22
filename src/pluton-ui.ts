import {
  clearCompletedTasks,
  exportReport,
  getPlutonState,
  importBulletin,
  retryFailedTasks,
  runQueue,
} from './pluton';

type ParsedSportLifeMatch = {
  domakin?: string;
  gosti?: string;
  sifra?: string;
  vreme?: string;
  liga?: string;
  sport?: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    parsirajSportLife?: (text: string) => ParsedSportLifeMatch[];
  }
}

const mainContent = document.querySelector<HTMLElement>('.main-content');
const bottomNav = document.querySelector<HTMLElement>('.bottom-nav');

if (mainContent && bottomNav && !document.getElementById('tab-pluton')) {
  const style = document.createElement('style');
  style.textContent = `
    .bottom-nav .nav-item { width: 20%; }
    .pluton-shell { color: var(--text-main, #f8fafc); }
    .pluton-shell .pluton-card { background: var(--bg-surface, #131c31); border: 1px solid var(--border, #1c3b5e); border-radius: 14px; padding: 14px; margin: 12px 0; }
    .pluton-shell .pluton-intro { color: var(--text-muted, #94a3b8); font-size: 13px; line-height: 1.55; margin: 8px 0 12px; }
    .pluton-shell .pluton-badge { display: inline-block; color: #9af0d6; background: #103b34; border-radius: 999px; padding: 5px 8px; font-size: 10px; font-weight: 800; letter-spacing: .04em; }
    .pluton-shell .pluton-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; margin: 12px 0; }
    .pluton-shell .pluton-stat { background: #101e30; border: 1px solid #22364b; border-radius: 10px; padding: 10px 7px; min-width: 0; }
    .pluton-shell .pluton-stat span { display:block; color:#9fb0c5; font-size:10px; }
    .pluton-shell .pluton-stat strong { display:block; font-size:21px; margin-top:5px; overflow-wrap:anywhere; }
    .pluton-shell textarea, .pluton-shell select, .pluton-shell input[type=file] { width:100%; color:var(--text-main,#f8fafc); background:#050c16; border:1px solid #2d465f; border-radius:9px; padding:10px; margin:7px 0; }
    .pluton-shell textarea { min-height:155px; resize:vertical; font:12px/1.5 ui-monospace,monospace; }
    .pluton-shell .pluton-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }
    .pluton-shell .pluton-btn { flex:1 1 130px; min-height:39px; border:1px solid #2d465f; border-radius:9px; padding:9px; color:#e6eef8; background:#14263b; font-weight:700; font-size:12px; }
    .pluton-shell .pluton-btn.primary { color:#06221e; background:#65e2c4; border-color:#65e2c4; }
    .pluton-shell .pluton-btn.danger { color:#ffc7c7; background:#351d2a; border-color:#66333e; }
    .pluton-shell .pluton-message { min-height:18px; color:#9af0d6; font-size:12px; line-height:1.5; overflow-wrap:anywhere; margin:8px 0 0; }
    .pluton-shell .pluton-message.error { color:#ff9999; }
    .pluton-shell .pluton-table-wrap { overflow-x:auto; }
    .pluton-shell table { border-collapse:collapse; width:100%; font-size:11px; }
    .pluton-shell th,.pluton-shell td { text-align:left; vertical-align:top; padding:8px 6px; border-bottom:1px solid #22364b; overflow-wrap:anywhere; }
    .pluton-shell th { color:#9fb0c5; font-size:10px; }
    .pluton-shell .pluton-status { display:inline-block; border-radius:999px; padding:3px 6px; white-space:nowrap; font-size:10px; font-weight:800; }
    .pluton-shell .pluton-status.done { color:#8ce8d1; background:#103b34; }
    .pluton-shell .pluton-status.queued { color:#f7d88a; background:#3a2d17; }
    .pluton-shell .pluton-status.failed { color:#ffaaaa; background:#43202a; }
    .pluton-shell .pluton-small { color:#8297ad; font-size:10px; line-height:1.5; }
    @media (max-width:380px) { .pluton-shell .pluton-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .pluton-shell .pluton-stat strong { font-size:19px; } }
  `;
  document.head.appendChild(style);

  const tab = document.createElement('div');
  tab.id = 'tab-pluton';
  tab.className = 'tab-content';
  tab.innerHTML = `
    <div class="pluton-shell">
      <div class="section-title">PLUTON CODE ♠</div>
      <span class="pluton-badge">ЛОКАЛНО · БЕЗ API ПОВИЦИ</span>
      <p class="pluton-intro">Јадро за внесување, распределба, проверка и извештаи. Надворешни AI повици се исклучени; ниту еден API не се повикува без посебна дозвола.</p>
      <div class="pluton-stats">
        <div class="pluton-stat"><span>Вкупно</span><strong id="pluton-total">0</strong></div>
        <div class="pluton-stat"><span>Во редица</span><strong id="pluton-queued">0</strong></div>
        <div class="pluton-stat"><span>Завршени</span><strong id="pluton-done">0</strong></div>
        <div class="pluton-stat"><span>Грешки</span><strong id="pluton-failed">0</strong></div>
      </div>
      <section class="pluton-card">
        <h3>1. Внес на билтен</h3>
        <p class="pluton-intro">Може да внесеш JSON билтен или суров SportLife текст. Суровиот текст се чита преку постојниот локален парсер на апликацијата, ако препознае мечеви.</p>
        <label for="pluton-format" class="pluton-small">Формат на влез</label>
        <select id="pluton-format"><option value="sportlife">Суров SportLife текст</option><option value="json">JSON билтен</option><option value="csv">CSV датотека (AppSheet/Sheets)</option></select>
        <label for="pluton-chiefs" class="pluton-small">Број на логички шефови</label>
        <select id="pluton-chiefs"><option value="100">100 шефови</option><option value="400" selected>400 шефови</option><option value="1000">1000 шефови</option></select>
        <textarea id="pluton-input" spellcheck="false" placeholder="Вметни го билтенот тука..."></textarea>
        <input id="pluton-file" type="file" accept=".txt,.json,.csv,text/plain,application/json,text/csv" aria-label="Избери датотека со билтен">
        <div class="pluton-actions">
          <button id="pluton-import" class="pluton-btn primary">Внеси и распредели</button>
          <button id="pluton-sample" class="pluton-btn">Вчитај тест-пример</button>
        </div>
        <p id="pluton-input-message" class="pluton-message" role="status"></p>
      </section>
      <section class="pluton-card">
        <h3>2. Обработка и извештај</h3>
        <p class="pluton-intro">Проверува имиња, дупликатни домашни/гостински имиња и структура. Не потврдува реални резултати и не создава спортски прогнози со AI.</p>
        <div class="pluton-actions">
          <button id="pluton-run" class="pluton-btn primary">Обработи редица</button>
          <button id="pluton-retry" class="pluton-btn">JOKER 1: повтори грешки</button>
          <button id="pluton-clear" class="pluton-btn danger">Исчисти завршени</button>
          <button id="pluton-export-json" class="pluton-btn">Извези JSON</button>
          <button id="pluton-export-csv" class="pluton-btn">Извези CSV за AppSheet</button>
        </div>
        <p id="pluton-engine-message" class="pluton-message" role="status"></p>
        <p class="pluton-small">Локалното зачувување е во овој прелистувач и не се синхронизира автоматски со друг телефон, GitHub или AppSheet. CSV-извозот е мост за рачен увоз, не автоматска конекција.</p>
      </section>
      <section class="pluton-card">
        <h3>3. Последни задачи</h3>
        <div class="pluton-table-wrap"><table><thead><tr><th>Натпревар</th><th>Шеф</th><th>Статус</th><th>Резултат</th></tr></thead><tbody id="pluton-rows"><tr><td colspan="4">Нема задачи.</td></tr></tbody></table></div>
      </section>
    </div>
  `;
  mainContent.appendChild(tab);

  const nav = document.createElement('div');
  nav.className = 'nav-item';
  nav.setAttribute('role', 'button');
  nav.setAttribute('tabindex', '0');
  nav.setAttribute('aria-label', 'PLUTON CODE');
  nav.innerHTML = '<div class="nav-icon">♠</div><span class="nav-text">PLUTON</span>';
  const activate = () => {
    document.querySelectorAll('.tab-content').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    nav.classList.add('active');
    render();
  };
  nav.addEventListener('click', activate);
  nav.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });
  bottomNav.appendChild(nav);

  const input = document.getElementById('pluton-input') as HTMLTextAreaElement;
  const fileInput = document.getElementById('pluton-file') as HTMLInputElement;
  const format = document.getElementById('pluton-format') as HTMLSelectElement;
  const chiefs = document.getElementById('pluton-chiefs') as HTMLSelectElement;

  function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function message(id: string, text: string, error = false): void {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('error', error);
  }

  function download(filename: string, content: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvCell(value: unknown): string {
    const safe = String(value ?? '').replace(/\r?\n/g, ' ');
    return '"' + safe.replace(/"/g, '""') + '"';
  }

  function parseCsvRecords(text: string): Record<string, unknown>[] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"' && cell.length === 0) quoted = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\\n') { row.push(cell.replace(/\\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += char;
    }
    if (quoted) throw new Error('CSV има незатворени наводници.');
    if (cell.length || row.length) { row.push(cell.replace(/\\r$/, '')); rows.push(row); }
    const nonEmpty = rows.filter(cells => cells.some(value => value.trim() !== ''));
    if (nonEmpty.length < 2) throw new Error('CSV мора да содржи заглавие и најмалку еден ред.');
    const normalize = (value: string) => value.replace(/^\\uFEFF/, '').trim().toLowerCase().replace(/[\\s_-]+/g, '');
    const headers = nonEmpty[0].map(normalize);
    const homeAliases = ['hometeam', 'home', 'hometeamname', 'domakin', 'domakjin', 'domaќin'.toLowerCase()];
    const awayAliases = ['awayteam', 'away', 'awayteamname', 'gosti', 'gostin', 'gost'];
    const homeIndex = headers.findIndex(header => homeAliases.includes(header));
    const awayIndex = headers.findIndex(header => awayAliases.includes(header));
    if (homeIndex < 0 || awayIndex < 0) {
      throw new Error('CSV заглавието мора да содржи homeTeam/awayTeam или domakin/gosti.');
    }
    const matchIndex = headers.findIndex(header => ['matchid', 'sifra', 'matchcode', 'id'].includes(header));
    return nonEmpty.slice(1).map(cells => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => { if (header) record[header] = (cells[index] ?? '').trim(); });
      const homeTeam = (cells[homeIndex] ?? '').trim();
      const awayTeam = (cells[awayIndex] ?? '').trim();
      const matchId = matchIndex >= 0 ? (cells[matchIndex] ?? '').trim() : '';
      return { ...record, homeTeam, awayTeam, ...(matchId ? { matchId } : {}) };
    });
  }

  function render(): void {
    const tasks = getPlutonState().tasks;
    document.getElementById('pluton-total')!.textContent = String(tasks.length);
    document.getElementById('pluton-queued')!.textContent = String(tasks.filter(task => task.status === 'queued').length);
    document.getElementById('pluton-done')!.textContent = String(tasks.filter(task => task.status === 'done').length);
    document.getElementById('pluton-failed')!.textContent = String(tasks.filter(task => task.status === 'failed').length);
    const recent = tasks.slice(-50).reverse();
    document.getElementById('pluton-rows')!.innerHTML = recent.length ? recent.map(task => {
      const status = task.status === 'done' ? 'Завршена' : task.status === 'failed' ? 'Грешка' : 'Во редица';
      const result = task.result ? JSON.stringify(task.result) : task.error || 'Чека';
      return `<tr><td>${escapeHtml(task.title)}<div class="pluton-small">${escapeHtml(task.id.slice(0, 8))}</div></td><td>${escapeHtml(task.chiefId)}</td><td><span class="pluton-status ${task.status}">${status}</span></td><td>${escapeHtml(result)}</td></tr>`;
    }).join('') : '<tr><td colspan="4">Нема задачи.</td></tr>';
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      message('pluton-input-message', 'Датотеката е поголема од 1 MB.', true);
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      input.value = String(reader.result ?? '');
      format.value = file.name.toLowerCase().endsWith('.json') ? 'json' : file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'sportlife';
      message('pluton-input-message', `Вчитана датотека: ${file.name}`);
    };
    reader.onerror = () => message('pluton-input-message', 'Не успеав да ја прочитам датотеката.', true);
    reader.readAsText(file);
  });

  document.getElementById('pluton-sample')!.addEventListener('click', () => {
    format.value = 'json';
    input.value = JSON.stringify({ matches: [
      { matchId: 'DEMO-001', sport: 'Football', league: 'Example League', homeTeam: 'FC Example', awayTeam: 'United Example', odds: { home: 1.8, draw: 3.4, away: 4.2 } },
      { matchId: 'DEMO-002', sport: 'Football', league: 'Example League', homeTeam: 'Real Sample', awayTeam: 'Sample City' },
    ] }, null, 2);
    message('pluton-input-message', 'Вчитан тест-пример. Ова се фиктивни податоци.');
  });

  document.getElementById('pluton-import')!.addEventListener('click', () => {
    try {
      let jsonInput = input.value;
      if (format.value === 'sportlife') {
        if (!window.parsirajSportLife) throw new Error('Постојниот SportLife парсер не е достапен. Избери JSON или CSV формат.');
        const parsed = window.parsirajSportLife(input.value);
        const matches = parsed.map((item, index) => ({
          ...item,
          matchId: item.sifra?.trim() || `MATCH-${String(index + 1).padStart(4, '0')}`,
          homeTeam: item.domakin,
          awayTeam: item.gosti,
        }));
        jsonInput = JSON.stringify({ matches });
      } else if (format.value === 'csv') {
        jsonInput = JSON.stringify({ matches: parseCsvRecords(input.value) });
      }
      const result = importBulletin(jsonInput, Number(chiefs.value));
      message('pluton-input-message', `Внесени: ${result.imported}; прескокнати записи: ${result.skipped}. Распределбата е локална.`, result.imported === 0);
      render();
    } catch (error) {
      message('pluton-input-message', error instanceof Error ? error.message : 'Грешка при внесување.', true);
    }
  });

  document.getElementById('pluton-run')!.addEventListener('click', () => {
    try {
      const result = runQueue(1000);
      message('pluton-engine-message', `Завршени: ${result.done}; грешки: ${result.failed}; останати во редица: ${result.remaining}.`);
      render();
    } catch (error) {
      message('pluton-engine-message', error instanceof Error ? error.message : 'Грешка при обработка.', true);
    }
  });

  document.getElementById('pluton-retry')!.addEventListener('click', () => {
    const retried = retryFailedTasks();
    message('pluton-engine-message', retried ? `JOKER 1: ${retried} задачи вратени во редица (најмногу 3 обиди по задача).` : 'Нема неуспешни задачи што може повторно да се обидат.');
    render();
  });

  document.getElementById('pluton-clear')!.addEventListener('click', () => {
    const removed = clearCompletedTasks();
    message('pluton-engine-message', `Отстранети од локалната историја: ${removed}. Задачите во редица се зачувани.`);
    render();
  });

  document.getElementById('pluton-export-json')!.addEventListener('click', () => {
    download(`zlatko-pluton-${new Date().toISOString().slice(0, 10)}.json`, exportReport(), 'application/json;charset=utf-8');
    message('pluton-engine-message', 'JSON-извештајот е извезен.');
  });

  document.getElementById('pluton-export-csv')!.addEventListener('click', () => {
    const tasks = getPlutonState().tasks;
    const columns = ['ID', 'matchId', 'homeTeam', 'awayTeam', 'chiefId', 'status', 'valid', 'errors', 'sport', 'liga', 'vreme', 'sifra'];
    const rows = tasks.map(task => {
      const payload = task.payload;
      const result = task.result ?? {};
      return columns.map(column => {
        if (column === 'ID') return csvCell(task.id);
        if (column === 'chiefId') return csvCell(task.chiefId);
        if (column === 'status') return csvCell(task.status);
        if (column === 'valid') return csvCell(result.valid ?? '');
        if (column === 'errors') return csvCell(Array.isArray(result.errors) ? result.errors.join('; ') : task.error ?? '');
        return csvCell(payload[column] ?? '');
      }).join(',');
    });
    download(`zlatko-pluton-appsheet-${new Date().toISOString().slice(0, 10)}.csv`, [columns.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    message('pluton-engine-message', 'CSV е извезен за рачен увоз во Google Sheets/AppSheet. Автоматска синхронизација не е активна.');
  });

  render();
}
