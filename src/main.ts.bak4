import './style.css'

const modules = [
  { id: 1, name: "Zlatko AI (Ultimate Fusion)", icon: "🌪️", color: "#FBBF24" },
  { id: 2, name: "Gemini za nadgradba", icon: "✨", color: "#3B82F6" },
  { id: 3, name: "Web strana", icon: "🌐", color: "#06B6D4" },
  { id: 4, name: "Sportski vesti", icon: "⚽", color: "#10B981" },
  { id: 5, name: "Real Madrid Info", icon: "👑", color: "#F59E0B" },
  { id: 6, name: "F1 Info", icon: "🏎️", color: "#EF4444" },
  { id: 7, name: "Viber", icon: "💜", color: "#8B5CF6" },
  { id: 8, name: "WhatsApp", icon: "💬", color: "#22C55E" },
  { id: 9, name: "Facebook", icon: "🔵", color: "#2563EB" },
  { id: 10, name: "Instagram", icon: "📸", color: "#EC4899" },
  { id: 11, name: "Gmail", icon: "✉️", color: "#EA4335" },
  { id: 12, name: "Proekt Preveduvac", icon: "🗣️", color: "#14B8A6" },
  { id: 13, name: "Proekt Blokator", icon: "🛡️", color: "#F97316" },
  { id: 14, name: "QR kod", icon: "📱", color: "#64748B" },
  { id: 15, name: "Za dodavanje aplikacija", icon: "➕", color: "#6B7280" },
  { id: 16, name: "Excel Kalkulator", icon: "📊", color: "#4ade80" }
];

window.renderDashboard = () => {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div id="main-dashboard" class="dashboard no-print">
      <header>
        <h1>🚀 Zlatko AI Mode Core</h1>
        <div class="system-stats">
          <div class="stat-box"><span class="stat-label">Работници</span><span class="stat-value">99,999</span></div>
        </div>
      </header>
      <div class="section-title">Системски Полиња</div>
      <div class="grid">
        ${modules.map(mod => {
          if (mod.id === 1) {
            return `<div class="card active-card main-core-card" style="border-left: 4px solid ${mod.color}">
              <div class="icon">${mod.icon}</div><h3>${mod.name}</h3>
              <p class="status">Споени сите 11 сили во една</p>
              <button class="btn btn-play" style="background: #FBBF24; color: black;" onclick="window.openModule(${mod.id})">Otvori Ultimate Fusion</button>
            </div>`;
          }
          return `<div class="card active-card" style="border-left: 4px solid ${mod.color}">
            <div class="icon">${mod.icon}</div><h3>${mod.name}</h3>
            <button class="btn" onclick="window.openModule(${mod.id})">Otvori</button>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="module-screen" style="display: none;" class="dashboard"></div>
  `;
}

window.openModule = (id: number) => {
  const dashboard = document.getElementById('main-dashboard');
  const moduleScreen = document.getElementById('module-screen');
  if (!dashboard || !moduleScreen) return;

  dashboard.style.display = 'none';
  moduleScreen.style.display = 'block';
  
  const mod = modules.find(m => m.id === id);
  if (!mod) return;

  let content = '';

  if (id === 1) {
    // ULTIMATE FUSION SCREEN
    content = `
      <div class="fusion-container no-print">
        <h2 style="color: #FBBF24; text-align: center; font-size: 2rem; text-transform: uppercase;">🌪️ Ultimate Fusion Engine</h2>
        <p style="text-align: center; color: #94a3b8; margin-bottom: 2rem;">Кликни за да ги споиме сите 11 сили во еден совршен AI мозок.</p>
        
        <div class="fusion-grid">
          <div class="fusion-item" style="border-color: #F97316;">🦊<br>Лисица<br><small>Value</small></div>
          <div class="fusion-item" style="border-color: #64748B;">🐺<br>Волк<br><small>Тим</small></div>
          <div class="fusion-item" style="border-color: #78350F;">🐻<br>Мечка<br><small>Сила</small></div>
          <div class="fusion-item" style="border-color: #94A3B8;">🐰<br>Зајак<br><small>Брзина</small></div>
          <div class="fusion-item" style="border-color: #38BDF8;">🦅<br>Орел<br><small>Вид</small></div>
          <div class="fusion-item" style="border-color: #EF4444;">🏎️<br>F1<br><small>Прецизност</small></div>
          <div class="fusion-item" style="border-color: #A16207;">🐕<br>Куче<br><small>Траги</small></div>
          <div class="fusion-item" style="border-color: #FBBF24;">👤<br>Човек<br><small>Мозок</small></div>
          <div class="fusion-item" style="border-color: #06B6D4;">🖥️<br>Компјутер<br><small>Логика</small></div>
          <div class="fusion-item" style="border-color: #10B981;">💻<br>Кодирање<br><small>Мозок</small></div>
          <!-- НОВО: GOOGLE STREET -->
          <div class="fusion-item" style="border-color: #4285F4;">🌍<br>Google Street<br><small>Географија</small></div>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <button class="btn" style="background: #8B5CF6; font-size: 1.2rem; padding: 1rem; box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);" onclick="window.triggerFusion()">🔥 СПОЈ ГИ СИТЕ СИЛИ</button>
        </div>

        <div id="fusion-result" style="display: none; margin-top: 2rem; background: #0f172a; padding: 2rem; border-radius: 12px; border: 2px solid #FBBF24; text-align: left;"></div>
      </div>
    `;
  } else if (id === 16) {
    content = `
      <div class="terminal-box">
        <p class="terminal-text">> [MODULE] Excel Kalkulatorot e aktiven.</p>
      </div>
    `;
  } else {
    content = `<div class="terminal-box"><p class="terminal-text">> [MODULE] Активен...</p></div>`;
  }

  moduleScreen.innerHTML = `
    <div class="module-header no-print">
      <button class="btn-back" onclick="window.closeModule()">⬅️ Назад</button>
      <h1>${mod.icon} ${mod.name}</h1>
    </div>
    <div class="module-body">${content}</div>
  `;
}

// ФУНКЦИЈА ЗА ФУЗИЈА
window.triggerFusion = () => {
  const resultDiv = document.getElementById('fusion-result');
  if (!resultDiv) return;

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = `<h3 style="color: #FBBF24;">> [СИСТЕМ] Започнува спојување на силите...</h3>`;
  
  const steps = [
    "> Внесување на брзината на F1 и Зајакот...",
    "> Активирање на видот на Орелот (скенирање на 35 лиги)...",
    "> Вклучување на трагачот (Куче) за движење на коефициенти...",
    "> Додавање на лукавството на Лисицата (Smart Money)...",
    "> Синхронизирање на Волкот со 99.999 работници...",
    "> Вградување на силата на Мечката (Bankroll)...",
    "> Качување на човечкиот мозок (Deep Thinking)...",
    "> Внесување на компјутерската логика (0 и 1, 100% прецизност)...",
    "> Додавање на мозокот за кодирање (Програмирање)...",
    // НОВ ЧЕКОР ЗА GOOGLE STREET
    "> 🌍 [GOOGLE STREET] Скенирање на локации, стадиони, временски услови и патувања на тимовите...",
    "> ✅ ФУЗИЈАТА Е ЗАВРШЕНА! ZLATKO AI E СЕСИЛЕН."
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i < steps.length) {
      resultDiv.innerHTML += `<p style="color: #4ade80; font-family: monospace; margin: 5px 0;">${steps[i]}</p>`;
      i++;
    } else {
      clearInterval(interval);
      resultDiv.innerHTML += `
        <div style="margin-top: 1rem; padding: 1rem; background: #1e1b4b; border-radius: 8px; border-left: 4px solid #FBBF24;">
          <h2 style="color: #c084fc; margin: 0;">🌪️ ZLATKO AI ULTIMATE</h2>
          <p style="color: white;">Сега ги имам сите 11 сили. Можам да ја проверам и локацијата на стадионот, времето, и се. Кажи ми што да анализираме.</p>
        </div>
      `;
    }
  }, 800);
}

window.closeModule = () => {
  document.getElementById('main-dashboard')!.style.display = 'block';
  document.getElementById('module-screen')!.style.display = 'none';
}

window.renderDashboard();
