// ================================================
// ORTO — Main Application Script
// ================================================

const HEADERS = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

// ---- API Helpers ----
async function getStato(entity_id) {
  const r = await fetch(`${HA_URL}/api/states/${entity_id}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function setStato(entity_id, accendi) {
  const dominio = entity_id.split(".")[0];
  const servizio = accendi ? "turn_on" : "turn_off";
  await fetch(`${HA_URL}/api/services/${dominio}/${servizio}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ entity_id })
  });
}

// ---- Formatting Helpers ----
function formatOra(iso) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function tempoFa(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minuti = Math.floor(diffMs / 60000);
  if (minuti < 1) return "appena ora";
  if (minuti < 60) return `${minuti} min fa`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? "ora" : "ore"} fa`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`;
}

function statoTemperatura(valore) {
  if (valore < 10) return "Freddo";
  if (valore < 30) return "Normale";
  return "Caldo";
}

function statoUmidita(valore) {
  if (valore < 30) return "Secco";
  if (valore < 70) return "Ottimale";
  return "Umido";
}

function formattaBatteria(stateValue) {
  const numerico = parseFloat(stateValue);
  if (!isNaN(numerico)) {
    let icona = "🔋";
    if (numerico < 20) icona = "🪫";
    return { testo: `${Math.round(numerico)}%`, icona };
  }
  const mappa = { low: "Bassa", middle: "Media", high: "Alta" };
  const iconeMappa = { low: "🪫", middle: "🔋", high: "🔋" };
  return {
    testo: mappa[stateValue] || stateValue,
    icona: iconeMappa[stateValue] || "🔋"
  };
}

// ================================================
// TAB NAVIGATION
// ================================================
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Recupera l'ultimo tab visitato (di default apre 'mappa')
const savedTab = localStorage.getItem('orto_active_tab') || 'mappa';

// Pulisce lo stato 'active' da tutti i bottoni e contenuti
tabBtns.forEach(b => b.classList.remove('active'));
tabContents.forEach(c => c.classList.remove('active'));

// Imposta il tab salvato come attivo
const initialBtn = document.querySelector(`.tab-btn[data-tab="${savedTab}"]`);
const initialTab = document.getElementById(`tab-${savedTab}`);
if (initialBtn && initialTab) {
  initialBtn.classList.add('active');
  initialTab.classList.add('active');
} else {
  // Fallback di sicurezza alla mappa
  document.querySelector('.tab-btn[data-tab="mappa"]').classList.add('active');
  document.getElementById('tab-mappa').classList.add('active');
}

// Gestione del click sui tab
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    
    // Aggiorna la UI rimuovendo/aggiungendo le classi 'active'
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
    
    // Salva la scelta nel browser
    localStorage.setItem('orto_active_tab', target);
  });
});

// ================================================
// GARDEN MAP (SVG)
// ================================================
// Layout:
// - Left:  1 bed 5m x 1m (top-aligned with right beds)
// - Right: 3 beds 6m x 1m each (stacked vertically with gaps)
// - Tool shed: below the left bed, occupying the remaining space
//
// We use a coordinate system where 1m = 60px for clarity
// The garden total: roughly 6m wide (left bed + gap + right beds) x 6m+ tall

function creaMappaOrto() {
  const container = document.getElementById('garden-map');

  // Scale: 1m = 60 units in SVG 
  const S = 60;
  
  // Perimeter 7m x 6.3m
  const totalW = 7 * S;
  const totalH = 6.3 * S;
  
  const MARGIN = 0.5 * S;        // 0.5m margin from perimeter (left/right)
  const TOP_MARGIN = 0.1 * S;    // 10cm margin from top perimeter
  const GAP = 0.5 * S;           // 0.5m gap between most beds
  const A2_A3_GAP = 1 * S;       // 1m gap between A2 and A3

  // Beds dimensions in meters
  const leftBedW = 1;    // 1m wide
  const leftBedH = 5.2;  // 5.2m long (vertical)
  const rightBedW = 1;   // 1m wide
  const rightBedH = 6;   // 6m long (vertical)
  const rightBedCount = 3;

  // Calculate positions
  const leftX = MARGIN;
  const leftY = TOP_MARGIN;
  const leftW = leftBedW * S;
  const leftH = leftBedH * S;

  // Right beds start at same Y as left
  const rightStartX = leftX + leftW + GAP;
  const rightW = rightBedW * S;
  const rightH = rightBedH * S;

  const rightBedsX = [];
  let currentX = rightStartX;
  for (let i = 0; i < rightBedCount; i++) {
    rightBedsX.push(currentX);
    const currentGap = (i === 0) ? A2_A3_GAP : GAP;
    currentX += rightW + currentGap;
  }

  // Shed: 1.2m x 0.6m, 5cm from left perimeter, 30cm from left bed
  const shedX = 0.05 * S;
  const shedY = leftY + leftH + (0.3 * S);
  const shedW = 1.2 * S;
  const shedH = 0.6 * S;

  // SVG dimensions for viewBox to avoid clipping if elements overflow
  const viewW = totalW;
  const viewH = Math.max(totalH, shedY + shedH, leftY + rightH);

  // Build SVG
  let svg = `<svg viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mappa dell'orto">`;

  // Background pattern (soil texture)
  svg += `
    <defs>
      <pattern id="soil-pattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.5" fill="rgba(255,255,255,0.03)"/>
        <circle cx="6" cy="6" r="0.5" fill="rgba(255,255,255,0.02)"/>
      </pattern>
      <pattern id="bed-pattern" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
        <line x1="0" y1="12" x2="12" y2="0" stroke="rgba(34,197,94,0.08)" stroke-width="0.5"/>
      </pattern>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="sensor-glow">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
  `;

  // Background
  svg += `<rect width="${totalW}" height="${totalH}" fill="var(--bg-elevated)" rx="8"/>`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="url(#soil-pattern)" rx="8"/>`;



  // ---- Left Bed (Aiuola 1: 5m x 1m) ----
  svg += `
    <g class="bed-rect" data-bed="0">
      <rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" 
        fill="var(--bed-fill)" stroke="var(--bed-stroke)" stroke-width="1.5" rx="4"
        style="transition: all 0.3s ease"/>
      <rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" 
        fill="url(#bed-pattern)" rx="4"/>
    </g>
  `;

  // ---- Base Casotto e Botte ----
  svg += `
    <rect x="${shedX}" y="${shedY}" width="${shedW}" height="${shedH}" 
      fill="var(--shed-fill)" stroke="var(--shed-stroke)" stroke-width="1.5" rx="4"
      stroke-dasharray="4,3"/>
  `;

  const botteW = shedW / 2;
  const casottoW = shedW / 2;
  const botteCx = shedX + botteW / 2;
  const casottoCx = shedX + botteW + casottoW / 2;
  const cy = shedY + shedH / 2;
  const r = (Math.min(botteW, shedH) / 2) - 2;

  // Botte (cerchio a sinistra)
  svg += `
    <g>
      <circle cx="${botteCx}" cy="${cy}" r="${r}" 
        fill="rgba(6, 182, 212, 0.1)" stroke="var(--cyan)" stroke-width="1.5"/>
      <text x="${botteCx}" y="${cy}" class="shed-label" 
        dominant-baseline="middle">💧</text>
    </g>
  `;

  // Quadrato Casotto (a destra)
  const pad = 4;
  svg += `
    <g>
      <rect x="${shedX + botteW + pad}" y="${shedY + pad}" width="${casottoW - pad*2}" height="${shedH - pad*2}" 
        fill="rgba(255, 255, 255, 0.05)" stroke="var(--shed-stroke)" stroke-width="1.5" rx="4"/>
      <text x="${casottoCx}" y="${cy}" class="shed-label" 
        dominant-baseline="middle">🏠</text>
    </g>
  `;

  // ---- Right Beds (Aiuole 2, 3, 4: 6m x 1m each) ----
  for (let i = 0; i < rightBedCount; i++) {
    const bx = rightBedsX[i];
    const by = leftY;
    const bedNum = i + 2;

    svg += `
      <g class="bed-rect" data-bed="${bedNum - 1}">
        <rect x="${bx}" y="${by}" width="${rightW}" height="${rightH}" 
          fill="var(--bed-fill)" stroke="var(--bed-stroke)" stroke-width="1.5" rx="4"
          style="transition: all 0.3s ease"/>
        <rect x="${bx}" y="${by}" width="${rightW}" height="${rightH}" 
          fill="url(#bed-pattern)" rx="4"/>

      </g>
    `;
  }

  // ---- Small beds between A2 and A3 ----
  const smallBedW = 0.26 * S;
  const smallBedH = 2.15 * S;
  // 2 beds, so 3 gaps (top, middle, bottom) for perfect centering
  const smallBedGap = (rightH - 2 * smallBedH) / 3;
  const smallBedX = rightBedsX[0] + rightW + A2_A3_GAP / 2 - smallBedW / 2;

  for (let j = 0; j < 2; j++) {
    const sby = leftY + smallBedGap + j * (smallBedH + smallBedGap);
    svg += `
      <g class="bed-rect" data-bed="small-${j}">
        <rect x="${smallBedX}" y="${sby}" width="${smallBedW}" height="${smallBedH}" 
          fill="var(--bed-fill)" stroke="var(--bed-stroke)" stroke-width="1.5" rx="4"
          style="transition: all 0.3s ease"/>
        <rect x="${smallBedX}" y="${sby}" width="${smallBedW}" height="${smallBedH}" 
          fill="url(#bed-pattern)" rx="4"/>
      </g>
    `;
  }

  svg += `</svg>`;
  container.innerHTML = svg;
}

// ================================================
// SENSOR MARKER PLACEMENT ON MAP
// ================================================
// This data structure maps sensors to garden bed positions
// Will be used to place sensors on the map in the future
const SENSOR_POSITIONS = [
  // { stationIndex: 0, bed: 0, x: 0.5, y: 0.5 } — normalized position within bed
];

// ================================================
// SENSOR DETAIL MODAL
// ================================================
const modalOverlay = document.getElementById('sensor-modal');
const modalClose = document.getElementById('modal-close');

function apriModaleSensore(stazione, index) {
  const modal = document.getElementById('sensor-modal');
  document.getElementById('modal-title').textContent = stazione.nome;

  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="modal-reading">
      <div class="modal-reading-icon temp">🌡️</div>
      <div class="modal-reading-info">
        <div class="modal-reading-label">Temperatura</div>
        <div class="modal-reading-value loading" id="modal-temp-${index}">—<span>°C</span></div>
        <div class="modal-reading-sub" id="modal-sub-temp-${index}">—</div>
      </div>
    </div>
    <div class="modal-reading">
      <div class="modal-reading-icon humidity">💧</div>
      <div class="modal-reading-info">
        <div class="modal-reading-label">Umidità</div>
        <div class="modal-reading-value loading" id="modal-hum-${index}">—<span>%</span></div>
        <div class="modal-reading-sub" id="modal-sub-hum-${index}">—</div>
      </div>
    </div>
    <div class="modal-reading">
      <div class="modal-reading-icon battery">🔋</div>
      <div class="modal-reading-info">
        <div class="modal-reading-label">Batteria</div>
        <div class="modal-reading-value loading" id="modal-bat-${index}">—</div>
        <div class="modal-reading-sub" id="modal-sub-bat-${index}">—</div>
      </div>
    </div>
  `;

  modal.classList.add('visible');

  // Fetch live data for modal
  aggiornaModaleSensore(stazione, index);
}

async function aggiornaModaleSensore(stazione, index) {
  try {
    const [t, u, b] = await Promise.all([
      getStato(stazione.temperatura),
      getStato(stazione.umidita),
      getStato(stazione.batteria),
    ]);

    const tempVal = parseFloat(t.state);
    const umidVal = parseFloat(u.state);
    const bat = formattaBatteria(b.state);

    const tempEl = document.getElementById(`modal-temp-${index}`);
    if (tempEl) {
      tempEl.innerHTML = `${tempVal.toFixed(1)}<span>°C</span>`;
      tempEl.classList.remove('loading');
    }
    const subTempEl = document.getElementById(`modal-sub-temp-${index}`);
    if (subTempEl) subTempEl.textContent = statoTemperatura(tempVal);

    const humEl = document.getElementById(`modal-hum-${index}`);
    if (humEl) {
      humEl.innerHTML = `${Math.round(umidVal)}<span>%</span>`;
      humEl.classList.remove('loading');
    }
    const subHumEl = document.getElementById(`modal-sub-hum-${index}`);
    if (subHumEl) subHumEl.textContent = statoUmidita(umidVal);

    const batEl = document.getElementById(`modal-bat-${index}`);
    if (batEl) {
      batEl.innerHTML = bat.testo;
      batEl.classList.remove('loading');
    }
  } catch (e) {
    console.warn('Errore modal sensore:', e);
  }
}

function chiudiModale() {
  document.getElementById('sensor-modal').classList.remove('visible');
}

modalClose.addEventListener('click', chiudiModale);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) chiudiModale();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') chiudiModale();
});

// ================================================
// SENSOR STATION CARDS
// ================================================
function creaStazione(stazione, index) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="section-label-row">
      <div class="section-label">${stazione.nome}</div>
      <div class="section-timestamp" id="timestamp-${index}">—</div>
    </div>
    <div class="grid-3">
      <div class="card">
        <div class="card-icon">🌡️</div>
        <div class="card-label">Temperatura</div>
        <div class="card-value loading" id="val-temp-${index}">—<span>°C</span></div>
        <div class="card-sub" id="sub-temp-${index}">—</div>
      </div>
      <div class="card">
        <div class="card-icon">💧</div>
        <div class="card-label">Umidità</div>
        <div class="card-value loading" id="val-umidita-${index}">—<span>%</span></div>
        <div class="card-sub" id="sub-umidita-${index}">—</div>
      </div>
      <div class="card">
        <div class="card-icon" id="icon-batteria-${index}">🔋</div>
        <div class="card-label">Batteria</div>
        <div class="card-value loading" id="val-batteria-${index}">—</div>
        <div class="card-sub" id="sub-batteria-${index}">—</div>
      </div>
    </div>
  `;
  document.getElementById("stazioni-container").appendChild(wrap);
}

async function aggiornaStazione(stazione, index) {
  try {
    const [t, u, b] = await Promise.all([
      getStato(stazione.temperatura),
      getStato(stazione.umidita),
      getStato(stazione.batteria),
    ]);

    const tempVal = parseFloat(t.state);
    const umidVal = parseFloat(u.state);
    const bat = formattaBatteria(b.state);

    document.getElementById(`val-temp-${index}`).innerHTML = `${tempVal.toFixed(1)}<span>°C</span>`;
    document.getElementById(`sub-temp-${index}`).textContent = statoTemperatura(tempVal);
    document.getElementById(`val-temp-${index}`).classList.remove("loading");

    document.getElementById(`val-umidita-${index}`).innerHTML = `${Math.round(umidVal)}<span>%</span>`;
    document.getElementById(`sub-umidita-${index}`).textContent = statoUmidita(umidVal);
    document.getElementById(`val-umidita-${index}`).classList.remove("loading");

    document.getElementById(`icon-batteria-${index}`).textContent = bat.icona;
    document.getElementById(`val-batteria-${index}`).innerHTML = bat.testo;
    document.getElementById(`val-batteria-${index}`).classList.remove("loading");

    const tStamp = new Date(t.last_updated).getTime();
    const uStamp = new Date(u.last_updated).getTime();
    const piuRecente = tStamp > uStamp ? t.last_updated : u.last_updated;
    document.getElementById(`timestamp-${index}`).textContent = `Aggiornato ${tempoFa(piuRecente)}`;

    return t.last_updated;
  } catch (e) {
    return null;
  }
}

// ================================================
// PUMPS
// ================================================
function creaPompa(pompa) {
  const div = document.createElement("div");
  div.className = "pump-card";
  const icon = pompa.icona || "💦";
  div.innerHTML = `
    <div class="pump-info">
      <div class="pump-name">${icon} ${pompa.nome}</div>
      <div class="pump-state loading" id="state-${pompa.entity_id}">—</div>
    </div>
    <label class="toggle" aria-label="Attiva ${pompa.nome}">
      <input type="checkbox" id="toggle-${pompa.entity_id}">
      <div class="toggle-track"></div>
      <div class="toggle-thumb"></div>
    </label>
  `;
  document.getElementById("pompe-container").appendChild(div);

  const checkbox = document.getElementById(`toggle-${pompa.entity_id}`);
  checkbox.addEventListener("change", async () => {
    await setStato(pompa.entity_id, checkbox.checked);
    setTimeout(() => aggiornaPompa(pompa), 800);
  });
}

async function aggiornaPompa(pompa) {
  try {
    const stato = await getStato(pompa.entity_id);
    const on = stato.state === "on";
    const stateEl = document.getElementById(`state-${pompa.entity_id}`);
    const checkbox = document.getElementById(`toggle-${pompa.entity_id}`);
    stateEl.textContent = on ? "Accesa" : "Spenta";
    stateEl.className = `pump-state ${on ? "on" : ""}`;
    checkbox.checked = on;
  } catch (e) {
    const stateEl = document.getElementById(`state-${pompa.entity_id}`);
    if (stateEl) stateEl.textContent = "—";
  }
}

// ================================================
// CONNECTION STATUS
// ================================================
function impostaOnline(ultimoAggiornamento) {
  document.getElementById("status-badge").classList.remove("offline");
  document.getElementById("status-text").textContent = "Online";
  document.getElementById("error-msg").style.display = "none";
  if (ultimoAggiornamento) {
    document.getElementById("last-update").textContent = `Aggiornato ${formatOra(ultimoAggiornamento)}`;
  }
}

function impostaOffline() {
  document.getElementById("status-badge").classList.add("offline");
  document.getElementById("status-text").textContent = "Offline";
  document.getElementById("error-msg").style.display = "block";
}

async function aggiornaTutto() {
  const risultati = await Promise.all(
    STAZIONI.map((s, i) => aggiornaStazione(s, i))
  );
  for (const p of POMPE) await aggiornaPompa(p);

  const almenoUnoOk = risultati.some(r => r !== null);
  const ultimoTimestamp = risultati.find(r => r !== null);
  if (almenoUnoOk) {
    impostaOnline(ultimoTimestamp);
  } else {
    impostaOffline();
  }
}

// ================================================
// INITIALIZATION
// ================================================
creaMappaOrto();
window.addEventListener('resize', creaMappaOrto);
STAZIONI.forEach((s, i) => creaStazione(s, i));
POMPE.forEach(creaPompa);
aggiornaTutto();
setInterval(aggiornaTutto, 30000);
