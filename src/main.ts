import './style.css';
import { createZlatkoOneBrain } from './zlatko-one-brain';

const brain = createZlatkoOneBrain();
let activeCaseId: string | null = null;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="app">
    <header class="topbar">
      <span>🧠 ZLATKO ONE BRAIN</span>
      <span id="brain-state" role="status">Локален режим · подготвен</span>
    </header>
    <main class="main">
      <section class="brain-panel" aria-labelledby="brain-title">
        <h1 id="brain-title">Еден мозок · 3 тима · 12 улоги</h1>
        <p>Централна контролна точка за истрага, обработка и човечка проверка.</p>
        <div class="brain-stats">
          <div><strong>12</strong><span>улоги</span></div>
          <div><strong>100</strong><span>слотови за агенти</span></div>
          <div><strong>30</strong><span>слотови за модели</span></div>
          <div><strong id="configured-models">0/30</strong><span>поврзани модели</span></div>
        </div>
        <div class="brain-actions">
          <button id="start-case" class="btn-run">① Започни тест-случај</button>
          <button id="record-scout" disabled>② Fox + Wolf проверка</button>
          <button id="submit-evidence" disabled>③ Предај докази</button>
          <button id="process-case" disabled>④ Обработи</button>
        </div>
        <p id="case-state" role="status">Нема активен случај.</p>
        <pre id="brain-log" aria-live="polite">Чекам команда.</pre>
        <p class="safety-note">Нема автоматски надворешни API повици. Нема поврзани модели додека не се регистрираат дозволени адаптери. Сите конечни одлуки бараат човечки проверувач.</p>
      </section>

      <details class="legacy-panel">
        <summary>Алатка за код во слика (постоечка)</summary>
        <textarea id="code-input" spellcheck="false">// Внеси го твојот код тука
function zlatko() {
  console.log("Zdravo od Zlatko AI!");
  return true;
}</textarea>
        <button id="btn-run" class="btn-run">▶ Конвертирај во Слика</button>
        <div id="image-container" class="image-container">
          <p>Сликата ќе се појави тука...</p>
        </div>
      </details>
    </main>
  </div>
`;

const state = brain.getSystemStatus();
document.getElementById('configured-models')!.textContent = `${state.configuredModels}/${state.modelSlots}`;

function log(value: unknown): void {
  document.getElementById('brain-log')!.textContent = JSON.stringify(value, null, 2);
}

function refreshButtons(): void {
  const snapshot = activeCaseId ? brain.getCase(activeCaseId) : null;
  document.getElementById('record-scout')!.toggleAttribute('disabled', !snapshot || snapshot.investigation.stage !== 'scouting');
  document.getElementById('submit-evidence')!.toggleAttribute('disabled', !snapshot || snapshot.investigation.stage !== 'joint-investigation');
  document.getElementById('process-case')!.toggleAttribute('disabled', !snapshot || snapshot.investigation.stage !== 'processing');
  document.getElementById('case-state')!.textContent = snapshot
    ? `Случај: ${snapshot.investigation.caseId} · Фаза: ${snapshot.investigation.stage}`
    : 'Нема активен случај.';
}

document.getElementById('start-case')!.addEventListener('click', () => {
  const caseId = `case-${Date.now()}`;
  try {
    const snapshot = brain.startCase({
      caseId,
      matchId: 'demo-match',
      scanSignals: ['DEMO: тест-сигнал за проверка; не е реално сомневање'],
    });
    activeCaseId = caseId;
    log({ message: 'Случајот е отворен во локалната меморија.', snapshot, system: brain.getSystemStatus() });
    refreshButtons();
  } catch (error) {
    log({ error: error instanceof Error ? error.message : String(error) });
  }
});

document.getElementById('record-scout')!.addEventListener('click', () => {
  if (!activeCaseId) return;
  try {
    const snapshot = brain.recordScoutFindings(activeCaseId, [
      'DEMO: Rabbit scout проверил примерни податоци; не е реално сомневање.',
      'DEMO: Fox и Wolf треба независно да ги споредат изворите пред обработка.',
    ]);
    log({ message: 'Здружената проверка е започната. Сигналите остануваат траги, не доказ за вина.', snapshot });
    refreshButtons();
  } catch (error) {
    log({ error: error instanceof Error ? error.message : String(error) });
  }
});

document.getElementById('submit-evidence')!.addEventListener('click', () => {
  if (!activeCaseId) return;
  try {
    const snapshot = brain.submitEvidence(activeCaseId, [
      'DEMO: примерен запис за тестирање на текот; не е вистински доказ.',
    ]);
    log({ message: 'Демо-доказите се предадени на Тим 2.', snapshot });
    refreshButtons();
  } catch (error) {
    log({ error: error instanceof Error ? error.message : String(error) });
  }
});

document.getElementById('process-case')!.addEventListener('click', async () => {
  if (!activeCaseId) return;
  const button = document.getElementById('process-case') as HTMLButtonElement;
  button.disabled = true;
  document.getElementById('brain-state')!.textContent = 'Се обработува локално...';
  try {
    const snapshot = await brain.processEvidence(activeCaseId, [
      { id: 'demo-task-1', title: 'Провери комплетност на демо-запис', input: { check: 'completeness' }, requiredCapabilities: [] },
      { id: 'demo-task-2', title: 'Подготви независна контролна задача', input: { check: 'consistency' }, requiredCapabilities: [] },
    ]);
    log({
      message: 'Текот на обединетиот мозок е извршен.',
      snapshot,
      note: snapshot.processingResults.every(result => result.status === 'skipped')
        ? 'Ова потврдува дека координацијата работи, но нема поврзан модел за вистинска AI анализа.'
        : 'Прегледај ги резултатите и потврди ги со човек.',
    });
    document.getElementById('brain-state')!.textContent = 'Локален режим · завршено';
  } catch (error) {
    log({ error: error instanceof Error ? error.message : String(error) });
    document.getElementById('brain-state')!.textContent = 'Грешка при обработка';
  } finally {
    refreshButtons();
  }
});

// Existing code-to-image tool retained, isolated from the One Brain workflow.
document.getElementById('btn-run')!.addEventListener('click', async () => {
  const code = (document.getElementById('code-input') as HTMLTextAreaElement).value;
  const container = document.getElementById('image-container')!;
  const btn = document.getElementById('btn-run') as HTMLButtonElement;
  btn.innerText = '⏳ Се обработува...';
  btn.disabled = true;
  container.innerHTML = '<p>⏳ Termux ја генерира сликата...</p>';
  try {
    const response = await fetch('http://127.0.0.1:3000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: { image?: string; error?: string } = await response.json();
    if (data.image) {
      const img = document.createElement('img');
      img.src = data.image;
      img.alt = 'Генерирана слика од код';
      img.style.maxWidth = '100%';
      img.style.borderRadius = '8px';
      container.replaceChildren(img);
    } else {
      container.textContent = `Грешка: ${data.error ?? 'Нема слика во одговорот'}`;
    }
  } catch (error) {
    container.textContent = `Не можам да се поврзам со Termux: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    btn.innerText = '▶ Конвертирај во Слика';
    btn.disabled = false;
  }
});
