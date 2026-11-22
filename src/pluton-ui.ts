import { DAMA_TREF_MAX_SOURCES, inspectDamaTrefInput, validateDamaTrefSourceUrl } from './pluton-dama-tref';
import { countJoker2Bands, JOKER2_BANDS, JOKER2_TOTAL_PLANNED_WORKERS, scanMatchCoefficients } from './pluton-joker2';
import {
  createPikovaProject,
  createPikovaState,
  enqueuePikovaTask,
  getPikovaOverview,
  getPikovaProjectView,
  grantPikovaRole,
  processPikovaQueue,
  retryPikovaFailures,
  validatePikovaState,
} from './pluton-pikova-dama';
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
    .pluton-shell .joker2-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0; }
    .pluton-shell .joker2-band { background:#101e30; border:1px solid #35435b; border-radius:10px; padding:10px; }
    .pluton-shell .joker2-band strong { display:block; font-size:15px; margin:4px 0; }
    .pluton-shell .joker2-band span { color:#9fb0c5; font-size:10px; }
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
      <section class="pluton-card" id="pluton-pikova-dama">
        <h3>ПИКОВА ДАМА ♠ — безбедни проекти за AS PIK</h3>
        <span class="pluton-badge">ЛОКАЛНО · ИЗОЛИРАНИ ПРОЕКТИ</span>
        <p class="pluton-intro">Посебна надградба: до 1.000 проекти, по 100 логички Плутони. Локална обработка и дневник на активности; нема плаќања, обложување или надворешни API повици.</p>
        <div class="pluton-stats">
          <div class="pluton-stat"><span>Проекти во овој прелистувач</span><strong id="pikova-project-count">0</strong></div>
          <div class="pluton-stat"><span>Распределени Плутони</span><strong id="pikova-pluton-count">0</strong></div>
          <div class="pluton-stat"><span>Цел проекти</span><strong>1.000</strong></div>
          <div class="pluton-stat"><span>Цел Плутони</span><strong>100.000</strong></div>
        </div>
        <label for="pikova-project-name" class="pluton-small">Име на нов проект</label>
        <input id="pikova-project-name" type="text" maxlength="160" placeholder="На пр. Проект 001">
        <div class="pluton-actions"><button id="pikova-create-project" class="pluton-btn primary">Креирај проект</button></div>
        <label for="pikova-project-select" class="pluton-small">Избери проект</label>
        <select id="pikova-project-select"><option value="">Нема проекти</option></select>
        <label for="pikova-task-title" class="pluton-small">Наслов на задача</label>
        <input id="pikova-task-title" type="text" maxlength="160" placeholder="Наслов / референца">
        <label for="pikova-idempotency" class="pluton-small">Уникатен клуч на задача</label>
        <input id="pikova-idempotency" type="text" maxlength="200" placeholder="На пр. MATCH-001-review">
        <label for="pikova-task-payload" class="pluton-small">Податоци на задачата (JSON објект)</label>
        <textarea id="pikova-task-payload" spellcheck="false" placeholder='{"matchId":"MATCH-001","notes":"локална проверка"}'></textarea>
        <div class="pluton-actions">
          <button id="pikova-enqueue" class="pluton-btn">Додај задача</button>
          <button id="pikova-process" class="pluton-btn primary">Обработи проект</button>
          <button id="pikova-retry" class="pluton-btn">Повтори грешки</button>
          <button id="pikova-export" class="pluton-btn">Извези дневник JSON</button>
        </div>
        <label for="pikova-import-file" class="pluton-small">Врати резервна копија од JSON</label>
        <input id="pikova-import-file" type="file" accept=".json,application/json" aria-label="Избери резервна копија на ПИКОВА ДАМА">
        <div class="pluton-card">
          <h4>Контрола на пристап</h4>
          <p class="pluton-small">Додај член со локален ID и улога. Ова е контрола на работниот тек во прелистувачот, не замена за серверска автентикација.</p>
          <input id="pikova-member-id" type="text" maxlength="120" placeholder="ID на член">
          <select id="pikova-member-role"><option value="operator">Оператор — работа</option><option value="viewer">Читач — само преглед</option></select>
          <div class="pluton-actions"><button id="pikova-grant-role" class="pluton-btn">Додели улога</button></div>
        </div>
        <p id="pikova-message" class="pluton-message" role="status"></p>
        <p class="pluton-small">Зачувувањето е локално на овој уред/прелистувач. За вистинска безбедност меѓу корисници потребни се серверска автентикација, серверска авторизација и база на податоци; оваа верзија не ги симулира како веќе активни услуги.</p>
        <div class="pluton-table-wrap"><table><thead><tr><th>Задача</th><th>Статус</th><th>Обиди</th><th>Резултат</th></tr></thead><tbody id="pikova-task-rows"><tr><td colspan="4">Избери или креирај проект.</td></tr></tbody></table></div>
      </section>
      <section class="pluton-card" id="pluton-dama-tref">
        <h3>ДАМА ТРЕФ ♣ — влезна безбедносна порта</h3>
        <span class="pluton-badge">POLICY DEMO · БЕЗ МРЕЖНИ ПОВИЦИ</span>
        <p class="pluton-intro">Проверува до 1.000 HTTPS адреси според точна листа на дозволени домени и прегледува внесен текст за ризични активни елементи. Оваа контролна табла не презема веб-страници и не е серверски firewall или антивирус.</p>
        <label for="dama-tref-hosts" class="pluton-small">Дозволени домени (еден hostname по ред, без https://)</label>
        <textarea id="dama-tref-hosts" spellcheck="false" placeholder="example.com&#10;news.example.org"></textarea>
        <label for="dama-tref-urls" class="pluton-small">Регистар на извори — до 1.000 HTTPS URL адреси</label>
        <textarea id="dama-tref-urls" spellcheck="false" placeholder="https://example.com/news"></textarea>
        <div class="pluton-actions"><button id="dama-tref-check-urls" class="pluton-btn primary">Провери листа на извори</button></div>
        <label for="dama-tref-input" class="pluton-small">Тест-влез (се обработува како текст, никогаш не се извршува)</label>
        <select id="dama-tref-content-type"><option value="text/plain">Plain text</option><option value="application/json">JSON</option><option value="text/csv">CSV</option><option value="text/html">HTML — само како податок</option></select>
        <textarea id="dama-tref-input" spellcheck="false" placeholder="Внеси тест-текст или JSON за проверка..."></textarea>
        <div class="pluton-actions"><button id="dama-tref-inspect-input" class="pluton-btn">Провери влез</button></div>
        <p id="dama-tref-message" class="pluton-message" role="status"></p>
        <p class="pluton-small">Излезната политика е default-deny во библиотеката. Реално блокирање мрежа, безбедно преземање и антивирусно скенирање мора да се спроведат на сервер/изолирана околина; UI проверките сами по себе не ја обезбедуваат таа заштита.</p>
      </section>
      <section class="pluton-card" id="pluton-joker2">
        <h3>JOKER 2 ♣ — паралелна линија за коефициенти</h3>
        <p class="pluton-intro">Посебна линија покрај главната. Анализира ги коефициентите од внесениот билтен и ги групира во пет опсези. Бројките за работници се планирани логички капацитети, не активни компјутери.</p>
        <div class="pluton-stats">
          <div class="pluton-stat"><span>Планирани работници</span><strong id="joker2-workers">2.5M</strong></div>
          <div class="pluton-stat"><span>Прочитани коефициенти</span><strong id="joker2-total">0</strong></div>
          <div class="pluton-stat"><span>Надвор од опсезите</span><strong id="joker2-excluded">0</strong></div>
          <div class="pluton-stat"><span>Извори по работник</span><strong>1,000</strong></div>
        </div>
        <div class="joker2-grid">
          ${JOKER2_BANDS.map(band => '<div class="joker2-band"><span>Опсег ' + band.label + '</span><strong id="joker2-count-' + band.id + '">0 коефициенти</strong><span>' + band.plannedWorkers.toLocaleString('en-US') + ' планирани работници</span></div>').join('')}
        </div>
        <p class="pluton-small">Граници без преклопување: 5 влегува во 5–10; 10 во 10–20; 20 во 20–30; 30 останува во 20–30; само вредности поголеми од 30 влегуваат во „над 30“.</p>
        <div class="pluton-actions">
          <button id="joker2-scan" class="pluton-btn primary">Скенирај внесени коефициенти</button>
          <button id="joker2-export" class="pluton-btn">Извези JOKER 2 CSV</button>
        </div>
        <p id="joker2-message" class="pluton-message" role="status"></p>
        <div class="pluton-table-wrap"><table><thead><tr><th>Меч</th><th>Пазар</th><th>Коефициент</th><th>Опсег</th></tr></thead><tbody id="joker2-rows"><tr><td colspan="4">Увези билтен, па скенирај.</td></tr></tbody></table></div>
        <p class="pluton-small">Наследена опрема од линијата AS KARO: PLUTON CODE ♠, 1.000 веб-извори по работник како проектна цел и заедничка цел од 200 милиони компјутери. Нема реални веб-пребарувања или AI API повици во оваа верзија.</p>
      </section>
      <section class="pluton-card">
        <h3>4. Последни задачи</h3>
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
  let joker2Rows: ReturnType<typeof scanMatchCoefficients> = [];

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
    const columns = [
      'ID', 'matchId', 'homeTeam', 'awayTeam', 'chiefId', 'status', 'attempts',
      'valid', 'errors', 'error', 'sport', 'league', 'liga', 'vreme', 'sifra',
      'odds', 'homeNormalized', 'awayNormalized', 'createdAt', 'updatedAt',
    ];
    const rows = tasks.map(task => {
      const payload = task.payload;
      const result = task.result ?? {};
      return columns.map(column => {
        if (column === 'ID') return csvCell(task.id);
        if (column === 'chiefId') return csvCell(task.chiefId);
        if (column === 'status') return csvCell(task.status);
        if (column === 'attempts') return csvCell(task.attempts);
        if (column === 'createdAt') return csvCell(task.createdAt);
        if (column === 'updatedAt') return csvCell(task.updatedAt);
        if (column === 'error') return csvCell(task.error ?? '');
        if (column === 'valid') return csvCell(result.valid ?? '');
        if (column === 'errors') return csvCell(Array.isArray(result.errors) ? result.errors.join('; ') : task.error ?? '');
        if (column === 'homeNormalized' || column === 'awayNormalized') return csvCell(result[column] ?? '');
        const value = payload[column];
        return csvCell(value !== null && typeof value === 'object' ? JSON.stringify(value) : value ?? '');
      }).join(',');
    });
    download(`zlatko-pluton-appsheet-${new Date().toISOString().slice(0, 10)}.csv`, [columns.join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
    message('pluton-engine-message', 'CSV е извезен за рачен увоз во Google Sheets/AppSheet. Автоматска синхронизација не е активна.');
  });


  const PIKOVA_STORAGE_KEY = 'zlatko.pikova-dama.state.v1';
  const PIKOVA_ACTOR = { id: 'local-owner', role: 'owner' as const };
  let pikovaState = createPikovaState();
  let pikovaSelectedProject = '';
  try {
    const saved = localStorage.getItem(PIKOVA_STORAGE_KEY);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      pikovaState = validatePikovaState(parsed);
    }
  } catch {
    pikovaState = createPikovaState();
    message('pikova-message', 'Локалната состојба не помина проверка. Започна празна состојба; ако имаш JSON резервна копија, врати ја преку контролата подолу.', true);
  }

  function savePikova(): boolean {
    try {
      localStorage.setItem(PIKOVA_STORAGE_KEY, JSON.stringify(pikovaState));
      return true;
    } catch {
      message('pikova-message', 'Не може да се зачува во локалниот прелистувач. Извези го дневникот.', true);
      return false;
    }
  }

  function renderPikova(): void {
    const overview = getPikovaOverview(pikovaState, PIKOVA_ACTOR);
    document.getElementById('pikova-project-count')!.textContent = String(overview.projectCount);
    document.getElementById('pikova-pluton-count')!.textContent = overview.allocatedPlutons.toLocaleString('en-US');
    const select = document.getElementById('pikova-project-select') as HTMLSelectElement;
    const previous = pikovaSelectedProject || select.value;
    select.innerHTML = overview.projects.length
      ? overview.projects.map(project => '<option value="' + escapeHtml(project.id) + '">' + escapeHtml(project.name) + ' · ' + project.plutonAllocation + ' Плутони</option>').join('')
      : '<option value="">Нема проекти</option>';
    if (overview.projects.some(project => project.id === previous)) select.value = previous;
    pikovaSelectedProject = select.value;
    const body = document.getElementById('pikova-task-rows')!;
    if (!pikovaSelectedProject) {
      body.innerHTML = '<tr><td colspan="4">Креирај проект за да започнеш.</td></tr>';
      return;
    }
    const view = getPikovaProjectView(pikovaState, PIKOVA_ACTOR, pikovaSelectedProject);
    body.innerHTML = view.tasks.slice(-50).reverse().map(task => {
      const result = task.result?.summary ?? task.error ?? 'Чека';
      return '<tr><td>' + escapeHtml(task.title) + '<div class="pluton-small">' + escapeHtml(task.id.slice(0, 8)) + '</div></td><td><span class="pluton-status ' + task.status + '">' + escapeHtml(task.status) + '</span></td><td>' + task.attempts + '</td><td>' + escapeHtml(result) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">Нема задачи во овој проект.</td></tr>';
  }

  document.getElementById('pikova-create-project')!.addEventListener('click', () => {
    try {
      const name = (document.getElementById('pikova-project-name') as HTMLInputElement).value;
      const project = createPikovaProject(pikovaState, PIKOVA_ACTOR, name);
      pikovaSelectedProject = project.id;
      savePikova();
      renderPikova();
      message('pikova-message', 'Креиран е изолиран проект: ' + project.name + '. Распределба: 100 логички Плутони.');
    } catch (error) {
      message('pikova-message', error instanceof Error ? error.message : 'Грешка при креирање проект.', true);
    }
  });

  document.getElementById('pikova-project-select')!.addEventListener('change', event => {
    pikovaSelectedProject = (event.currentTarget as HTMLSelectElement).value;
    renderPikova();
  });

  document.getElementById('pikova-enqueue')!.addEventListener('click', () => {
    try {
      if (!pikovaSelectedProject) throw new Error('Прво креирај или избери проект.');
      const title = (document.getElementById('pikova-task-title') as HTMLInputElement).value;
      const keyInput = document.getElementById('pikova-idempotency') as HTMLInputElement;
      const key = keyInput.value.trim() || title.trim();
      const payloadText = (document.getElementById('pikova-task-payload') as HTMLTextAreaElement).value.trim() || '{}';
      const payload: unknown = JSON.parse(payloadText);
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Податоците мора да бидат JSON објект.');
      const result = enqueuePikovaTask(pikovaState, PIKOVA_ACTOR, pikovaSelectedProject, title, payload as Record<string, unknown>, key);
      savePikova();
      renderPikova();
      message('pikova-message', result.duplicate ? 'Дупликатот е спречен. Постои задача со истиот клуч во овој проект.' : 'Задачата е додадена во локалната редица.');
    } catch (error) {
      message('pikova-message', error instanceof Error ? error.message : 'Неуспешно додавање задача.', true);
    }
  });

  document.getElementById('pikova-process')!.addEventListener('click', () => {
    try {
      if (!pikovaSelectedProject) throw new Error('Прво избери проект.');
      const result = processPikovaQueue(pikovaState, PIKOVA_ACTOR, pikovaSelectedProject);
      savePikova();
      renderPikova();
      message('pikova-message', 'Обработени: ' + result.done + '; грешки: ' + result.failed + '; останати: ' + result.remaining + '. Само локална валидација, не прогноза.');
    } catch (error) {
      message('pikova-message', error instanceof Error ? error.message : 'Грешка при обработка.', true);
    }
  });

  document.getElementById('pikova-retry')!.addEventListener('click', () => {
    try {
      if (!pikovaSelectedProject) throw new Error('Прво избери проект.');
      const count = retryPikovaFailures(pikovaState, PIKOVA_ACTOR, pikovaSelectedProject);
      savePikova();
      renderPikova();
      message('pikova-message', 'Вратени во редица: ' + count + '. Максимум три обиди по задача.');
    } catch (error) {
      message('pikova-message', error instanceof Error ? error.message : 'Грешка при повторување.', true);
    }
  });

  document.getElementById('pikova-grant-role')!.addEventListener('click', () => {
    try {
      if (!pikovaSelectedProject) throw new Error('Прво избери проект.');
      const memberId = (document.getElementById('pikova-member-id') as HTMLInputElement).value;
      const role = (document.getElementById('pikova-member-role') as HTMLSelectElement).value as 'operator' | 'viewer';
      grantPikovaRole(pikovaState, PIKOVA_ACTOR, pikovaSelectedProject, memberId, role);
      savePikova();
      renderPikova();
      message('pikova-message', 'Улогата ' + role + ' е доделена на ' + memberId.trim() + ' за избраниот проект.');
    } catch (error) {
      message('pikova-message', error instanceof Error ? error.message : 'Грешка при доделување улога.', true);
    }
  });

  document.getElementById('pikova-export')!.addEventListener('click', () => {
    download('zlatko-pikova-dama-audit-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(pikovaState, null, 2), 'application/json;charset=utf-8');
    message('pikova-message', 'PIKOVA DAMA проектите, задачите и дневникот се извезени во JSON.');
  });

  document.getElementById('pikova-import-file')!.addEventListener('change', () => {
    const fileInput = document.getElementById('pikova-import-file') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      message('pikova-message', 'Резервната копија е поголема од 5 MB.', true);
      fileInput.value = '';
      return;
    }
    if ((pikovaState.projects.length || pikovaState.tasks.length || pikovaState.audit.length) &&
        !window.confirm('Враќањето ќе ја замени тековната локална состојба на ПИКОВА ДАМА. Прво извези копија ако ти треба. Продолжи?')) {
      fileInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const previousState = pikovaState;
      try {
        const parsed: unknown = JSON.parse(String(reader.result ?? ''));
        pikovaState = validatePikovaState(parsed);
        pikovaSelectedProject = '';
        if (!savePikova()) {
          pikovaState = previousState;
          renderPikova();
          return;
        }
        renderPikova();
        message('pikova-message', 'Резервната копија е проверена и вратена. Проекти: ' + pikovaState.projects.length + '; задачи: ' + pikovaState.tasks.length + '.');
      } catch (error) {
        pikovaState = previousState;
        renderPikova();
        message('pikova-message', error instanceof Error ? error.message : 'Резервната копија не може да се прочита.', true);
      } finally {
        fileInput.value = '';
      }
    };
    reader.onerror = () => {
      message('pikova-message', 'Не успеав да ја прочитам резервната копија.', true);
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('pikova-project-count')!.textContent = '0';
  renderPikova();

  document.getElementById('dama-tref-check-urls')!.addEventListener('click', () => {
    const hostText = (document.getElementById('dama-tref-hosts') as HTMLTextAreaElement).value;
    const hosts = hostText.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const lines = (document.getElementById('dama-tref-urls') as HTMLTextAreaElement).value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (lines.length > DAMA_TREF_MAX_SOURCES) {
      message('dama-tref-message', 'Надминат е лимитот од ' + DAMA_TREF_MAX_SOURCES + ' извори.', true);
      return;
    }
    let accepted = 0;
    const rejected: string[] = [];
    for (const line of lines) {
      try { validateDamaTrefSourceUrl(line, hosts); accepted += 1; }
      catch (error) { rejected.push(line + ': ' + (error instanceof Error ? error.message : 'Одбиено')); }
    }
    const detail = rejected.slice(0, 5).join(' | ');
    message('dama-tref-message', 'Проверени: ' + lines.length + '; прифатени според локалната политика: ' + accepted + '; одбиени: ' + rejected.length + '. Ниту една страница не е преземена.' + (detail ? ' Примери: ' + detail : ''), rejected.length > 0);
  });

  document.getElementById('dama-tref-inspect-input')!.addEventListener('click', () => {
    const content = (document.getElementById('dama-tref-input') as HTMLTextAreaElement).value;
    const contentType = (document.getElementById('dama-tref-content-type') as HTMLSelectElement).value;
    const result = inspectDamaTrefInput({ content, contentType });
    const details = result.reasons.length ? ' Причини: ' + result.reasons.join(' ') : ' Не се открија ризични шаблони во оваа основна проверка.';
    message('dama-tref-message', (result.accepted ? 'ВЛЕЗ ПРИФАТЕН ЗА ЛОКАЛНА ПРОВЕРКА' : 'ВЛЕЗ ОДБИЕН / КАРАНТИН') + ' · ' + result.bytes + ' бајти.' + details, !result.accepted);
  });

  document.getElementById('joker2-scan')!.addEventListener('click', () => {
    const tasks = getPlutonState().tasks;
    const matches = tasks.map(task => task.payload);
    joker2Rows = scanMatchCoefficients(matches);
    const counts = countJoker2Bands(joker2Rows);
    for (const band of JOKER2_BANDS) {
      const node = document.getElementById('joker2-count-' + band.id);
      if (node) node.textContent = String(counts[band.id] ?? 0) + ' коефициенти';
    }
    document.getElementById('joker2-total')!.textContent = String(joker2Rows.length);
    const allNumeric = matches.reduce((sum, match) => {
      const odds = match.odds;
      return sum + (typeof odds === 'object' && odds !== null && !Array.isArray(odds)
        ? Object.values(odds as Record<string, unknown>).filter(value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value))).length
        : 0);
    }, 0);
    document.getElementById('joker2-excluded')!.textContent = String(Math.max(0, allNumeric - joker2Rows.length));
    document.getElementById('joker2-rows')!.innerHTML = joker2Rows.length
      ? joker2Rows.slice(0, 250).map(row => '<tr><td>' + escapeHtml(row.matchId) + '<div class="pluton-small">' + escapeHtml(row.homeTeam) + ' — ' + escapeHtml(row.awayTeam) + '</div></td><td>' + escapeHtml(row.market) + '</td><td>' + escapeHtml(row.coefficient) + '</td><td>' + escapeHtml(row.bandLabel) + '</td></tr>').join('')
      : '<tr><td colspan="4">Нема коефициенти од 2 или повеќе во внесените задачи.</td></tr>';
    message('joker2-message', 'JOKER 2: анализирани ' + joker2Rows.length + ' коефициенти во пет опсези. Ова е локална класификација, не прогноза.');
  });

  document.getElementById('joker2-export')!.addEventListener('click', () => {
    const columns = ['matchId', 'homeTeam', 'awayTeam', 'market', 'coefficient', 'bandId', 'bandLabel'];
    const rows = joker2Rows.map(row => columns.map(column => csvCell(row[column as keyof typeof row])).join(','));
    download('zlatko-joker2-coefficients-' + new Date().toISOString().slice(0, 10) + '.csv', [columns.join(','), ...rows].join('\\r\\n'), 'text/csv;charset=utf-8');
    message('joker2-message', 'JOKER 2 CSV извезен: ' + joker2Rows.length + ' редови.');
  });

  document.getElementById('joker2-workers')!.textContent = JOKER2_TOTAL_PLANNED_WORKERS.toLocaleString('en-US');
  render();
}
