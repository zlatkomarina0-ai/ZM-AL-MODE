import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="app">
    <header class="topbar">
      <span>💻 Код</span>
      <button id="btn-run" class="btn-run">▶ Конвертирај во Слика</button>
    </header>
    <div class="main">
      <textarea id="code-input" spellcheck="false">
// Внеси го твојот код тука
function zlatko() {
  console.log("Zdravo od Zlatko AI!");
  return true;
}
      </textarea>
      <div id="image-container" class="image-container">
        <p style="color: #64748b;">Сликата ќе се појави тука...</p>
      </div>
    </div>
  </div>
`;

document.getElementById('btn-run')!.addEventListener('click', async () => {
  const code = (document.getElementById('code-input') as HTMLTextAreaElement).value;
  const container = document.getElementById('image-container')!;
  const btn = document.getElementById('btn-run') as HTMLButtonElement;

  btn.innerText = "⏳ Се обработува...";
  btn.disabled = true;
  container.innerHTML = '<p style="color: #38bdf8;">⏳ Termux ја генерира сликата...</p>';

  try {
    const response = await fetch('http://127.0.0.1:3000/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code })
    });

    const data = await response.json();
    if (data.image) {
      container.innerHTML = `<img src="${data.image}" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);" />`;
    } else {
      container.innerHTML = `<p style="color: #ef4444;">Грешка: ${data.error}</p>`;
    }
  } catch (error) {
    container.innerHTML = `<p style="color: #ef4444;">Не можам да се поврзам со Termux. Дали server.js работи?</p>`;
  } finally {
    btn.innerText = "▶ Конвертирај во Слика";
    btn.disabled = false;
  }
});
