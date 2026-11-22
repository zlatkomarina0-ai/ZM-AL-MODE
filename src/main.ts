import './style.css';
import {
  clearCompletedTasks,
  exportReport,
  getPlutonState,
  importBulletin,
  retryFailedTasks,
  runQueue,
} from './pluton';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root element.');

const sampleBulletin = JSON.stringify({
  matches: [
    { matchId: 'DEMO-001', homeTeam: 'FC Example', awayTeam: 'United Example' },
    { matchId: 'DEMO-002', homeTeam: 'Real Sample', awayTeam: 'Sample City' },
  ],
}, null, 2);

app.innerHTML = `
  <main class="pluton-app">
    <header class="pluton-header">
      <div>
        <p class="eyebrow">ZLATKO AI MODE · LOCAL CORE</p>
        <h1>PLUTON CODE <span>♠</span></h1>
        <p class="subtitle">Локален систем за внесување, распределба и обработка на спортски билтен.</p>
      </div>
      <div class="local-badge"><span></span> LOCAL · БЕЗ API</div>
    </header>
    <section class="pluton-notice">
      <strong>Бесплатен локален режим</strong>
      <p>Податоците се обработуваат во овој прелистувач. Не се повикуваат надворешни AI API-сервиси. Задачите се зачувуваат локално во прелистувачот.</p>
    </section>
    <section class="pluton-stats" aria-label="Статус на задачите">
      <article><span>Вкупно задачи</span><strong id="stat-total">0</strong></article>
      <article><span>Во редица</span><strong id="stat-queued">0</strong></article>
      <article><span>Завршени</span><strong id="stat-done">0</strong></article>
      <article><span>Грешки</span><strong id="stat-failed">0</strong></article>
    </section>
    <section class="pluton-panel">
      <div class="panel-heading"><div><p class="eyebrow">01 / INPUT</p><h2>Внеси спортски билтен</h2></div><span class="panel-hint">JSON · максимум 1 MB</span></div>
      <p class="help-text">Прифатен формат: низа од натпревари или објект со поле <code>matches</code>. Секој натпревар треба да има <code>homeTeam</code> и <code>awayTeam</code>.</p>
      <textarea id="bulletin-input" spellcheck="false" aria-label="JSON спортски билтен"></textarea>
      <div class="controls">
        <label class="chief-control">Логички шефови
          <select id="chief-count"><option value="100">100</option><option value="400" selected>400</option><option value="1000">1000</option></select>
        </label>
        <button id="btn-import" class="btn btn-primary">Внеси и распредели</button>
        <button id="btn-demo" class="btn btn-secondary">Вчитај пример</button>
      </div>
      <p id="input-message" class="message" role="status"></p>
    </section>
    <section class="pluton-panel">
      <div class="panel-heading"><div><p class="eyebrow">02 / ENGINE</p><h2>PLUTON обработка</h2></div><span class="panel-hint">Детерминистичка проверка</span></div>
      <p class="help-text">PLUTON ги проверува имињата на домашниот и гостинскиот тим, нормализира текст и означува очигледни проблеми. Ова не е AI-прогноза и не потврдува факти од интернет.</p>
      <div class="controls">
        <button id="btn-run" class="btn btn-primary">▶ Обработи редица</button>
        <button id="btn-retry" class="btn btn-secondary">Повтори неуспешни</button>
        <button id="btn-clear" class="btn btn-danger">Исчисти завршени</button>
        <button id="btn-export" class="btn btn-secondary">Извези извештај JSON</button>
      </div>
      <p id="engine-message" class="message" role="status"></p>
    </section>
    <section class="pluton-panel">
      <div class="panel-heading"><div><p class="eyebrow">03 / AUDIT</p><h2>Последни задачи</h2></div><button id="btn-refresh" class="btn btn-secondary btn-small">Освежи</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Натпревар / задача</th><th>Шеф</th><th>Статус</th><th>Резултат / грешка</th></tr></thead>
        <tbody id="task-rows"><tr><td colspan="4" class="empty">Нема внесени задачи.</td></tr></tbody>
      </table></div>
      <p class="footnote" id="last-run">Обработката сè уште не е стартувана.</p>
    </section>
    <footer class="pluton-footer">ZLATKO AI MODE · PLUTON CODE ♠ · v0.3.0</footer>
  </main>
`;

const input = document.getElementById('bulletin-input') as HTMLTextAreaElement;
input.value = sampleBulletin;

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function render() {
  const state = getPlutonState();
  const tasks = state.tasks;
  document.getElementById('stat-total')!.textContent = String(tasks.length);
  document.getElementById('stat-queued')!.textContent = String(tasks.filter(task => task.status === 'queued').length);
  document.getElementById('stat-done')!.textContent = String(tasks.filter(task => task.status === 'done').length);
  document.getElementById('stat-failed')!.textContent = String(tasks.filter(task => task.status === 'failed').length);

  const rows = tasks.slice(-100).reverse();
  const body = document.getElementById('task-rows')!;
  body.innerHTML = rows.length ? rows.map(task => {
    const result = task.result ? JSON.stringify(task.result) : task.error || 'Чека на обработка';
    const statusLabel = task.status === 'done' ? 'Завршена' : task.status === 'failed' ? 'Грешка' : 'Во редица';
    return `<tr>
      <td><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.id.slice(0, 8))}</small></td>
      <td>${escapeHtml(task.chiefId)}</td>
      <td><span class="status status-${task.status}">${statusLabel}</span></td>
      <td class="result-cell">${escapeHtml(result)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="4" class="empty">Нема внесени задачи.</td></tr>';

  document.getElementById('last-run')!.textContent = state.lastRunAt
    ? `Последна обработка: ${new Date(state.lastRunAt).toLocaleString()}`
    : 'Обработката сè уште не е стартувана.';
}

function setMessage(id: string, message: string, isError = false) {
  const node = document.getElementById(id)!;
  node.textContent = message;
  node.classList.toggle('message-error', isError);
  node.classList.toggle('message-success', !isError && Boolean(message));
}

document.getElementById('btn-import')!.addEventListener('click', () => {
  try {
    const chiefCount = Number((document.getElementById('chief-count') as HTMLSelectElement).value);
    const result = importBulletin(input.value, chiefCount);
    setMessage('input-message', `Внесени ${result.imported} задачи; прескокнати записи: ${result.skipped}. Распределбата е локална.`);
    render();
  } catch (error) {
    setMessage('input-message', error instanceof Error ? error.message : 'Грешка при внесување.', true);
  }
});

document.getElementById('btn-demo')!.addEventListener('click', () => {
  input.value = sampleBulletin;
  setMessage('input-message', 'Вчитан е тест-билтен. Притисни „Внеси и распредели“ за да го ставиш во редица.');
});

document.getElementById('btn-run')!.addEventListener('click', () => {
  try {
    const result = runQueue(1000);
    setMessage('engine-message', `Завршени: ${result.done}; грешки: ${result.failed}; останати во редица: ${result.remaining}.`);
    render();
  } catch (error) {
    setMessage('engine-message', error instanceof Error ? error.message : 'Грешка при обработка.', true);
  }
});

document.getElementById('btn-retry')!.addEventListener('click', () => {
  const retried = retryFailedTasks();
  setMessage('engine-message', `Повторно ставени во редица: ${retried}.`);
  render();
});

document.getElementById('btn-clear')!.addEventListener('click', () => {
  const removed = clearCompletedTasks();
  setMessage('engine-message', `Отстранети завршени и неуспешни задачи: ${removed}. Задачите во редица се зачувани.`);
  render();
});

document.getElementById('btn-export')!.addEventListener('click', () => {
  const blob = new Blob([exportReport()], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zlatko-pluton-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setMessage('engine-message', 'JSON-извештајот е подготвен за преземање.');
});

document.getElementById('btn-refresh')!.addEventListener('click', render);
render();
