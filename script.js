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
  let servizio = accendi ? "turn_on" : "turn_off";
  if (dominio === "valve") {
    servizio = accendi ? "open_valve" : "close_valve";
  }
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

// Stored geometry of right beds for sensor placement
let rightBedGeometry = [];

function creaMappaOrto() {
  const container = document.getElementById('garden-map');

  // Scale: 1m = 60 units in SVG 
  const S = 60;
  
  // Perimeter 7m x 6.3m
  const totalW = 7 * S;
  const totalH = 6.3 * S;
  
  const MARGIN = 0.5 * S;        // 0.5m margin from perimeter (left/right)
  const TOP_MARGIN = 0.6 * S;    // 60cm margin from top perimeter (room for buttons)
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

  // Save geometry for sensor placement
  rightBedGeometry = rightBedsX.map(bx => ({
    x: bx, y: leftY, w: rightW, h: rightH
  }));

  // Shed: 1.2m x 0.6m, 5cm from left perimeter, 30cm from left bed
  const shedX = 0.05 * S;
  const shedY = leftY + leftH + (0.3 * S);
  const shedW = 1.2 * S;
  const shedH = 0.6 * S;

  // SVG dimensions for viewBox to avoid clipping if elements overflow
  const viewW = totalW;
  const viewH = Math.max(totalH, leftY + rightH + 16);

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
      <filter id="sensor-glow-green">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sensor-glow-amber">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="sensor-glow-red">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  `;

  // Background
  svg += `<rect width="${viewW}" height="${viewH}" fill="var(--bg-elevated)" rx="8"/>`;
  svg += `<rect width="${viewW}" height="${viewH}" fill="url(#soil-pattern)" rx="8"/>`;



  // ---- Left Bed (Aiuola 1: 5.2m x 1m) ----
  svg += `
    <g class="bed-rect" data-bed="0">
      <rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" 
        fill="var(--bed-fill)" stroke="var(--bed-stroke)" stroke-width="1.5" rx="4"
        style="transition: all 0.3s ease"/>
      <rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" 
        fill="url(#bed-pattern)" rx="4"/>
    </g>
  `;

  // ---- Humidity label inside Aiuola 1 ----
  {
    const lx = leftX + leftW / 2;
    const ly = leftY + 18;
    svg += `
      <rect x="${lx - 20}" y="${ly - 10}" width="40" height="14" 
        rx="7" fill="rgba(59,130,246,0.18)" stroke="rgba(96,200,255,0.25)" stroke-width="0.5"/>
      <text x="${lx}" y="${ly}" 
        class="bed-humidity-label" id="bed-humidity-aiuola1"
        text-anchor="middle" dominant-baseline="auto">—%</text>
    `;
  }

  // ---- Sensor slots for Aiuola 1 ----
  {
    const slots = SENSORI_MAPPA.aiuola1 || [];
    const slotPositions = [0.2, 0.5, 0.8];
    const sensorCx = leftX + leftW / 2;

    for (let s = 0; s < 3; s++) {
      const sensorCy = leftY + leftH * slotPositions[s];
      const slotConfig = slots[s];
      const hasAssigned = slotConfig && slotConfig.stationIndex !== null;
      const sensorId = `sensor-aiuola1-${s}`;

      if (hasAssigned) {
        svg += `
          <g class="sensor-marker-group" id="${sensorId}" 
             data-aiuola="aiuola1" data-slot="${s}" 
             data-station="${slotConfig.stationIndex}"
             style="cursor:pointer">
            <circle cx="${sensorCx}" cy="${sensorCy}" r="9" 
              class="sensor-ring" fill="var(--sensor-empty-fill)" 
              stroke="var(--text-muted)" stroke-width="1.5"/>
            <circle cx="${sensorCx}" cy="${sensorCy}" r="4" 
              class="sensor-dot" fill="var(--text-muted)"/>
            <text x="${sensorCx}" y="${sensorCy + 17}" 
              class="sensor-slot-label" id="${sensorId}-label"
              text-anchor="middle" dominant-baseline="auto">—</text>
          </g>
        `;
      } else {
        svg += `
          <g class="sensor-slot-empty" id="${sensorId}">
            <circle cx="${sensorCx}" cy="${sensorCy}" r="8" 
              fill="none" stroke="var(--text-muted)" stroke-width="1" 
              stroke-dasharray="3,3" opacity="0.35"/>
          </g>
        `;
      }
    }
  }

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
  const aiuolaKeys = ['aiuola2', 'aiuola3', 'aiuola4'];
  for (let i = 0; i < rightBedCount; i++) {
    const bx = rightBedsX[i];
    const by = leftY;
    const bedNum = i + 2;
    const aiuolaKey = aiuolaKeys[i];

    svg += `
      <g class="bed-rect" data-bed="${bedNum - 1}">
        <rect x="${bx}" y="${by}" width="${rightW}" height="${rightH}" 
          fill="var(--bed-fill)" stroke="var(--bed-stroke)" stroke-width="1.5" rx="4"
          style="transition: all 0.3s ease"/>
        <rect x="${bx}" y="${by}" width="${rightW}" height="${rightH}" 
          fill="url(#bed-pattern)" rx="4"/>
      </g>
    `;

    // ---- Average humidity label inside the bed (top) ----
    {
      const lx = bx + rightW / 2;
      const ly = by + 18;
      svg += `
        <rect x="${lx - 20}" y="${ly - 10}" width="40" height="14" 
          rx="7" fill="rgba(59,130,246,0.18)" stroke="rgba(96,200,255,0.25)" stroke-width="0.5"/>
        <text x="${lx}" y="${ly}" 
          class="bed-humidity-label" id="bed-humidity-${aiuolaKey}"
          text-anchor="middle" dominant-baseline="auto">—%</text>
      `;
    }

    // ---- Sensor slots (3 per bed: top, middle, bottom) ----
    const slots = SENSORI_MAPPA[aiuolaKey] || [];
    const slotPositions = [0.18, 0.5, 0.82]; // normalized Y positions within the bed
    const sensorCx = bx + rightW / 2;        // center X of the bed

    for (let s = 0; s < 3; s++) {
      const sensorCy = by + rightH * slotPositions[s];
      const slotConfig = slots[s];
      const hasAssigned = slotConfig && slotConfig.stationIndex !== null;
      const sensorId = `sensor-${aiuolaKey}-${s}`;

      if (hasAssigned) {
        // Active sensor marker — color will be updated by aggiornaSensoriMappa()
        svg += `
          <g class="sensor-marker-group" id="${sensorId}" 
             data-aiuola="${aiuolaKey}" data-slot="${s}" 
             data-station="${slotConfig.stationIndex}"
             style="cursor:pointer">
            <circle cx="${sensorCx}" cy="${sensorCy}" r="9" 
              class="sensor-ring" fill="var(--sensor-empty-fill)" 
              stroke="var(--text-muted)" stroke-width="1.5"/>
            <circle cx="${sensorCx}" cy="${sensorCy}" r="4" 
              class="sensor-dot" fill="var(--text-muted)"/>
            <text x="${sensorCx}" y="${sensorCy + 17}" 
              class="sensor-slot-label" id="${sensorId}-label"
              text-anchor="middle" dominant-baseline="auto">—</text>
          </g>
        `;
      } else {
        // Empty slot — dashed circle placeholder
        svg += `
          <g class="sensor-slot-empty" id="${sensorId}">
            <circle cx="${sensorCx}" cy="${sensorCy}" r="8" 
              fill="none" stroke="var(--text-muted)" stroke-width="1" 
              stroke-dasharray="3,3" opacity="0.35"/>
          </g>
        `;
      }
    }
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

  // ================================================
  // IRRIGATION PIPES (Botte → Aiuole)
  // ================================================
  const pipeOffset = 12; // px from left edge of each bed
  const pipeTopY = leftY + 25; // Top of the vertical pipe in each bed

  const pipeOriginX = botteCx;
  const pipeOriginY = shedY; // Top of the botte

  const upperTrunkY = shedY - 9; // Just above the shed
  const lowerTrunkY = leftY + rightH + 8; // Below the right beds

  const slantStartX = shedX + shedW + 12; // Right of the shed
  const slantEndX = slantStartX + 12; // Slant horizontally

  const aiuola1X = leftX + pipeOffset;

  // Path for Aiuola 1
  const pathD1 = `M ${pipeOriginX} ${pipeOriginY} L ${pipeOriginX} ${upperTrunkY} L ${aiuola1X} ${upperTrunkY} L ${aiuola1X} ${pipeTopY}`;
  
  // Base path for Aiuola 2, 3, 4 (shared trunk to the right)
  const baseRightPath = `M ${pipeOriginX} ${pipeOriginY} L ${pipeOriginX} ${upperTrunkY} L ${slantStartX} ${upperTrunkY} L ${slantEndX} ${lowerTrunkY}`;

  svg += `<path class="pipe-path" id="pipe-aiuola1" d="${pathD1}"/>`;
  svg += `<path class="pipe-flow" id="pipe-flow-aiuola1" d="${pathD1}"/>`;

  for (let i = 0; i < rightBedCount; i++) {
    const aiuolaKey = aiuolaKeys[i];
    const aX = rightBedsX[i] + pipeOffset;
    const pathD = `${baseRightPath} L ${aX} ${lowerTrunkY} L ${aX} ${pipeTopY}`;

    svg += `<path class="pipe-path" id="pipe-${aiuolaKey}" d="${pathD}"/>`;
    svg += `<path class="pipe-flow" id="pipe-flow-${aiuolaKey}" d="${pathD}"/>`;
  }

  // Junction dot at botte
  svg += `<circle class="pipe-junction" id="pipe-junction" cx="${pipeOriginX}" cy="${pipeOriginY}" r="3.5"/>`;

  // ================================================
  // IRRIGATION BUTTONS (above each bed)
  // ================================================
  const irrigaBtnW = 70; // 60px button + 10px padding for shadows
  const irrigaBtnH = 28; // 22px button + 6px padding for shadows
  const irrigaBtnMargin = 4;

  // Aiuola 1 button
  {
    const btnX = leftX + leftW / 2 - irrigaBtnW / 2;
    const btnY = leftY - irrigaBtnH - irrigaBtnMargin;
    svg += `
      <foreignObject x="${btnX}" y="${btnY}" width="${irrigaBtnW}" height="${irrigaBtnH}">
        <button xmlns="http://www.w3.org/1999/xhtml" class="irriga-btn" id="irriga-btn-aiuola1"
          data-aiuola="aiuola1" title="Irriga Aiuola 1">
          💧 IRRIGA
        </button>
      </foreignObject>
    `;
  }

  // Aiuole 2, 3, 4 buttons
  for (let i = 0; i < rightBedCount; i++) {
    const aiuolaKey = aiuolaKeys[i];
    const bx = rightBedsX[i];
    const btnX = bx + rightW / 2 - irrigaBtnW / 2;
    const btnY = leftY - irrigaBtnH - irrigaBtnMargin;
    svg += `
      <foreignObject x="${btnX}" y="${btnY}" width="${irrigaBtnW}" height="${irrigaBtnH}">
        <button xmlns="http://www.w3.org/1999/xhtml" class="irriga-btn" id="irriga-btn-${aiuolaKey}"
          data-aiuola="${aiuolaKey}" title="Irriga ${IRRIGAZIONE[aiuolaKey].nome}">
          💧 IRRIGA
        </button>
      </foreignObject>
    `;
  }

  svg += `</svg>`;
  container.innerHTML = svg;

  // Attach click events to sensor markers
  container.querySelectorAll('.sensor-marker-group').forEach(g => {
    g.addEventListener('click', () => {
      const stIdx = parseInt(g.dataset.station, 10);
      if (STAZIONI[stIdx]) {
        apriModaleSensore(STAZIONI[stIdx], stIdx);
      }
    });
  });

  // Attach click events to irrigation buttons
  container.querySelectorAll('.irriga-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const aiuolaKey = btn.dataset.aiuola;
      if (btn.classList.contains('active')) {
        fermaIrrigazione(aiuolaKey);
      } else if (!btn.classList.contains('loading')) {
        sequenzaIrrigazione(aiuolaKey);
      }
    });
  });
}

// ================================================
// SENSOR DATA ON MAP — Battery colors & humidity
// ================================================

/**
 * Determine battery level from a HA state value.
 * Returns: 'high' | 'medium' | 'low' | 'offline'
 */
function livelloBatteria(stateValue) {
  if (stateValue === 'unavailable' || stateValue === 'unknown' || stateValue === undefined) {
    return 'offline';
  }
  const num = parseFloat(stateValue);
  if (!isNaN(num)) {
    if (num >= 60) return 'high';
    if (num >= 20) return 'medium';
    if (num >= 1) return 'low';
    return 'offline';
  }
  // Text-based: "low", "middle", "high"
  const mappa = { high: 'high', middle: 'medium', low: 'low' };
  return mappa[stateValue] || 'offline';
}

/**
 * Color mapping for battery levels
 */
const BATTERY_COLORS = {
  high:    { fill: 'rgba(34,197,94,0.2)',  stroke: '#22c55e', dot: '#22c55e', glow: 'sensor-glow-green' },
  medium:  { fill: 'rgba(245,158,11,0.2)', stroke: '#f59e0b', dot: '#f59e0b', glow: 'sensor-glow-amber' },
  low:     { fill: 'rgba(239,68,68,0.2)',  stroke: '#ef4444', dot: '#ef4444', glow: 'sensor-glow-red' },
  offline: { fill: 'rgba(255,255,255,0.04)', stroke: 'var(--text-muted)', dot: 'var(--text-muted)', glow: '' },
};

/**
 * Fetch live data for all mapped sensors and update the SVG markers.
 * Also computes and displays average humidity per bed.
 */
async function aggiornaSensoriMappa() {
  const aiuolaKeys = ['aiuola1', 'aiuola2', 'aiuola3', 'aiuola4'];

  for (const key of aiuolaKeys) {
    const slots = SENSORI_MAPPA[key] || [];
    const humidityValues = [];

    for (let s = 0; s < slots.length; s++) {
      const cfg = slots[s];
      if (cfg.stationIndex === null) continue;

      const stazione = STAZIONI[cfg.stationIndex];
      if (!stazione) continue;

      const sensorId = `sensor-${key}-${s}`;
      const group = document.getElementById(sensorId);
      if (!group) continue;

      try {
        const [batResp, humResp] = await Promise.all([
          getStato(stazione.batteria),
          getStato(stazione.umidita),
        ]);

        // Battery level → color
        const livello = livelloBatteria(batResp.state);
        const colors = BATTERY_COLORS[livello];

        const ring = group.querySelector('.sensor-ring');
        const dot = group.querySelector('.sensor-dot');
        if (ring) {
          ring.setAttribute('fill', colors.fill);
          ring.setAttribute('stroke', colors.stroke);
          if (colors.glow) {
            ring.setAttribute('filter', `url(#${colors.glow})`);
          } else {
            ring.removeAttribute('filter');
          }
        }
        if (dot) {
          dot.setAttribute('fill', colors.dot);
        }

        // Sub-label: show humidity only
        const label = document.getElementById(`${sensorId}-label`);
        const humVal = parseFloat(humResp.state);
        if (label) {
          if (!isNaN(humVal)) {
            humidityValues.push(humVal);
            label.textContent = `${Math.round(humVal)}%`;
          } else {
            label.textContent = '—';
          }
        }

        // Add pulsing class for low battery
        if (livello === 'low') {
          group.classList.add('sensor-pulse-warning');
        } else {
          group.classList.remove('sensor-pulse-warning');
        }

      } catch (e) {
        // On error, mark as offline
        const ring = group.querySelector('.sensor-ring');
        const dot = group.querySelector('.sensor-dot');
        const colors = BATTERY_COLORS.offline;
        if (ring) {
          ring.setAttribute('fill', colors.fill);
          ring.setAttribute('stroke', colors.stroke);
          ring.removeAttribute('filter');
        }
        if (dot) dot.setAttribute('fill', colors.dot);

        const label = document.getElementById(`${sensorId}-label`);
        if (label) label.textContent = 'offline';

        group.classList.remove('sensor-pulse-warning');
      }
    }

    // Update average humidity label above the bed
    const humLabel = document.getElementById(`bed-humidity-${key}`);
    if (humLabel) {
      if (humidityValues.length > 0) {
        const avg = Math.round(humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length);
        humLabel.textContent = `💧 ${avg}%`;
      } else {
        humLabel.textContent = `—%`;
      }
    }
  }
}

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
    const stateEl = document.getElementById(`state-${pompa.entity_id}`);
    if (stateEl) stateEl.classList.add("loading");
    checkbox.disabled = true;

    try {
      await setStato(pompa.entity_id, checkbox.checked);
    } catch (e) {
      console.error(e);
    }

    // Aspettiamo 3.5 secondi per dispositivi lenti (come le valvole RF)
    setTimeout(async () => {
      await aggiornaPompa(pompa);
      checkbox.disabled = false;
    }, 3500);
  });
}

async function aggiornaPompa(pompa) {
  try {
    const stato = await getStato(pompa.entity_id);
    const on = stato.state === "on" || stato.state === "open";
    const stateEl = document.getElementById(`state-${pompa.entity_id}`);
    const checkbox = document.getElementById(`toggle-${pompa.entity_id}`);
    
    const isValve = pompa.entity_id.startsWith("valve.");
    stateEl.textContent = on ? (isValve ? "Aperta" : "Accesa") : (isValve ? "Chiusa" : "Spenta");
    
    stateEl.className = `pump-state ${on ? "on" : ""}`;
    checkbox.checked = on;
  } catch (e) {
    const stateEl = document.getElementById(`state-${pompa.entity_id}`);
    if (stateEl) stateEl.textContent = "—";
  }
}

// ================================================
// IRRIGATION CONTROL SYSTEM
// ================================================

// State tracking for active irrigations
const irrigazioneAttiva = {}; // { aiuolaKey: { timer: timeoutId, startTime: timestamp, intervalId } }
let inverterOffTimer = null;

/**
 * Poll a HA entity until its state satisfies a condition.
 * @returns {Promise<boolean>} true if condition met, false if timeout
 */
async function aspettaStato(entity_id, condizione, timeoutMs = 30000, intervalMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const stato = await getStato(entity_id);
      if (condizione(stato.state)) return true;
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Start the irrigation sequence for a given aiuola.
 * Steps: 1) Inverter ON + wait valves online  2) Open valve + wait  3) Pump ON
 */
async function sequenzaIrrigazione(aiuolaKey) {
  const config = IRRIGAZIONE[aiuolaKey];
  if (!config) return;

  const btn = document.getElementById(`irriga-btn-${aiuolaKey}`);
  if (!btn) return;

  // Set button to loading state
  btn.classList.add('loading');
  btn.classList.remove('active');
  btn.innerHTML = `<span class="irriga-spinner"></span> Avvio…`;

  try {
    // Clear inverter turn-off timer if one is pending
    if (inverterOffTimer) {
      clearTimeout(inverterOffTimer);
      inverterOffTimer = null;
    }

    // ---- STEP 1: Ensure inverter is ON ----
    const inverterStato = await getStato(INVERTER_ENTITY);
    if (inverterStato.state !== 'on') {
      btn.innerHTML = `<span class="irriga-spinner"></span> Inverter…`;
      await setStato(INVERTER_ENTITY, true);

      // Wait for valve to become available (not 'unavailable')
      const valvolaOnline = await aspettaStato(
        config.valvola,
        (state) => state !== 'unavailable' && state !== 'unknown',
        30000, 2000
      );

      if (!valvolaOnline) {
        btn.classList.remove('loading');
        btn.innerHTML = `❌ Timeout`;
        setTimeout(() => { btn.innerHTML = `💧 IRRIGA`; }, 3000);
        return;
      }

      // Wait an extra 5 seconds to ensure the RF valve is fully initialized on the network
      btn.innerHTML = `<span class="irriga-spinner"></span> Rete…`;
      await new Promise(r => setTimeout(r, 5000));
    }

    // ---- STEP 2: Open valve ----
    btn.innerHTML = `<span class="irriga-spinner"></span> Valvola…`;
    
    let valvolaAperta = false;
    for (let tentativi = 0; tentativi < 3; tentativi++) {
      try {
        await setStato(config.valvola, true);
      } catch (err) {
        console.warn("Errore comando valvola:", err);
      }
      
      valvolaAperta = await aspettaStato(
        config.valvola,
        (state) => state === 'open',
        8000, 2000
      );
      
      if (valvolaAperta) break;
      console.warn(`Tentativo ${tentativi + 1} apertura valvola fallito, riprovo...`);
    }

    if (!valvolaAperta) {
      btn.classList.remove('loading');
      btn.innerHTML = `❌ Valvola`;
      setTimeout(() => { btn.innerHTML = `💧 IRRIGA`; }, 3000);
      return;
    }

    // ---- STEP 3: Turn on pump ----
    btn.innerHTML = `<span class="irriga-spinner"></span> Pompa…`;
    await setStato(POMPA_IRRIGAZIONE_ENTITY, true);

    // Wait a moment for pump to turn on
    await new Promise(r => setTimeout(r, 2000));

    // ---- SUCCESS: Mark as active ----
    btn.classList.remove('loading');
    btn.classList.add('active');
    btn.innerHTML = `🟢 Attiva`;

    // Activate pipe animation
    impostaTuboAttivo(aiuolaKey, true);

    // Avvio Timer in HA
    const inputDurata = document.getElementById("durata-irrigazione");
    const durataMin = inputDurata ? (parseInt(inputDurata.value, 10) || 60) : 60;
    const durationStr = `00:${String(durataMin).padStart(2, '0')}:00`;
    
    try {
      await fetch(`${HA_URL}/api/services/timer/start`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ entity_id: config.timer, duration: durationStr })
      });
    } catch(err) { console.warn("Errore avvio timer HA", err); }

    // Store active state local prediction
    irrigazioneAttiva[aiuolaKey] = {
      finishes_at: new Date(Date.now() + durataMin * 60000).toISOString()
    };

    // Show / update timer badge
    aggiornaTimerBadge();

    // Refresh pump states in the Pompe tab
    for (const p of POMPE) await aggiornaPompa(p);

  } catch (e) {
    console.error('Errore sequenza irrigazione:', e);
    btn.classList.remove('loading');
    btn.innerHTML = `❌ Errore`;
    setTimeout(() => { btn.innerHTML = `💧 IRRIGA`; }, 3000);
  }
}

/**
 * Stop irrigation for a given aiuola:
 * Close valve, turn off pump (if no other active irrigations), clear timer.
 */
async function fermaIrrigazione(aiuolaKey) {
  const config = IRRIGAZIONE[aiuolaKey];
  if (!config) return;

  const btn = document.getElementById(`irriga-btn-${aiuolaKey}`);

  // Remove from local active state
  delete irrigazioneAttiva[aiuolaKey];

  // Ferma il Timer in HA
  try {
    await fetch(`${HA_URL}/api/services/timer/cancel`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ entity_id: config.timer })
    });
  } catch(err) { console.warn("Errore cancel timer HA", err); }

  if (btn) {
    btn.classList.remove('active');
    btn.classList.add('loading');
    btn.innerHTML = `<span class="irriga-spinner"></span> Stop…`;
  }

  try {
    // Close valve
    try {
      await setStato(config.valvola, false);
    } catch (err) {
      console.warn("Errore chiusura valvola:", err);
    }

    // If no other irrigations are active, turn off pump
    const altreAttive = Object.keys(irrigazioneAttiva).length > 0;
    if (!altreAttive) {
      try {
        await setStato(POMPA_IRRIGAZIONE_ENTITY, false);
      } catch (err) {
        console.warn("Errore spegnimento pompa:", err);
      }
      
      // Spegni l'inverter dopo 5 minuti di inattività
      if (inverterOffTimer) {
        clearTimeout(inverterOffTimer);
      }
      inverterOffTimer = setTimeout(async () => {
        try {
          // Double check if no irrigations were started in the meantime
          if (Object.keys(irrigazioneAttiva).length === 0) {
            await setStato(INVERTER_ENTITY, false);
            for (const p of POMPE) aggiornaPompa(p);
          }
        } catch (e) { console.error("Errore spegnimento inverter", e); }
      }, 5 * 60 * 1000);
    }

    // Wait for valve to close
    await aspettaStato(config.valvola, (state) => state === 'closed', 10000, 2000);

  } catch (e) {
    console.error('Errore stop irrigazione:', e);
  }

  // Reset button
  if (btn) {
    btn.classList.remove('loading', 'active');
    btn.innerHTML = `💧 IRRIGA`;
  }

  // Deactivate pipe animation
  impostaTuboAttivo(aiuolaKey, false);

  // Update timer badge
  aggiornaTimerBadge();

  // Refresh pump states
  for (const p of POMPE) aggiornaPompa(p);
}

/**
 * Activate/deactivate pipe visuals for a given aiuola.
 */
function impostaTuboAttivo(aiuolaKey, attivo) {
  const pipe = document.getElementById(`pipe-${aiuolaKey}`);
  const flow = document.getElementById(`pipe-flow-${aiuolaKey}`);
  const junction = document.getElementById('pipe-junction');

  if (pipe) pipe.classList.toggle('pipe-active', attivo);
  if (flow) flow.classList.toggle('pipe-active', attivo);

  // Junction is active if ANY pipe is active
  if (junction) {
    const anyActive = Object.keys(irrigazioneAttiva).length > 0 || attivo;
    junction.classList.toggle('pipe-active', anyActive);
  }
}

/**
 * Sync pipe animations with actual valve states from HA.
 * Called periodically by aggiornaTutto().
 */
async function aggiornaStatoTubi() {
  const aiuolaKeys = ['aiuola1', 'aiuola2', 'aiuola3', 'aiuola4'];
  let anyActive = false;

  for (const key of aiuolaKeys) {
    const config = IRRIGAZIONE[key];
    if (!config) continue;

    try {
      // Leggi stato valvola e timer HA
      const [statoValvola, statoTimer] = await Promise.all([
        getStato(config.valvola).catch(() => ({state: 'unknown'})),
        getStato(config.timer).catch(() => ({state: 'idle'}))
      ]);
      
      const isOpen = statoValvola.state === 'open' || statoTimer.state === 'active';

      // Sincronizza stato locale con HA
      if (statoTimer.state === 'active' && statoTimer.attributes && statoTimer.attributes.finishes_at) {
         irrigazioneAttiva[key] = { finishes_at: statoTimer.attributes.finishes_at };
      } else if (statoTimer.state === 'idle') {
         delete irrigazioneAttiva[key];
      }

      const pipe = document.getElementById(`pipe-${key}`);
      const flow = document.getElementById(`pipe-flow-${key}`);
      if (pipe) pipe.classList.toggle('pipe-active', isOpen);
      if (flow) flow.classList.toggle('pipe-active', isOpen);

      // Update button state to match reality
      const btn = document.getElementById(`irriga-btn-${key}`);
      if (btn && !btn.classList.contains('loading')) {
        if (isOpen && !irrigazioneAttiva[key]) {
          // Valve opened externally — show as active but without auto-shutoff
          btn.classList.add('active');
          btn.innerHTML = `🟢 Attiva`;
        } else if (!isOpen && !irrigazioneAttiva[key]) {
          btn.classList.remove('active');
          btn.innerHTML = `💧 IRRIGA`;
        }
      }

      if (isOpen) anyActive = true;
    } catch (e) {
      // Valve unavailable — leave visual as-is
    }
  }

  // Update junction dot
  const junction = document.getElementById('pipe-junction');
  if (junction) junction.classList.toggle('pipe-active', anyActive);

  // Aggiorna la UI del badge timer (fondamentale per ripristinarlo al ricaricamento della pagina)
  aggiornaTimerBadge();
}

// ================================================
// IRRIGATION TIMER BADGE
// ================================================
let timerBadgeInterval = null;

function aggiornaTimerBadge() {
  const attive = Object.entries(irrigazioneAttiva);
  let badge = document.getElementById('irriga-timer-badge');

  if (attive.length === 0) {
    // Remove badge
    if (badge) badge.remove();
    if (timerBadgeInterval) {
      clearInterval(timerBadgeInterval);
      timerBadgeInterval = null;
    }
    return;
  }

  // Create badge if not exists
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'irriga-timer-badge';
    badge.id = 'irriga-timer-badge';
    document.body.appendChild(badge);
  }

  // Find the timer that finishes first
  let minRemainingMs = Infinity;
  for (const [, v] of attive) {
     if (!v.finishes_at) continue;
     const endMs = new Date(v.finishes_at).getTime();
     const remain = endMs - Date.now();
     if (remain > 0 && remain < minRemainingMs) minRemainingMs = remain;
  }
  
  const remainingMs = minRemainingMs === Infinity ? 0 : minRemainingMs;

  const nomiAttive = attive.map(([key]) => IRRIGAZIONE[key].nome).join(', ');
  const tempoRimasto = formatTempoRimasto(remainingMs);

  badge.innerHTML = `
    <div class="irriga-timer-dot"></div>
    <div class="irriga-timer-text">
      ${nomiAttive} — <span>${tempoRimasto}</span>
    </div>
    <button class="irriga-timer-stop" id="irriga-timer-stop-btn" title="Ferma tutte le irrigazioni">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
    </button>
  `;

  // Attach stop-all button
  document.getElementById('irriga-timer-stop-btn').addEventListener('click', () => {
    fermaIrrigazioneTutte();
  });

  // Start interval for live countdown update
  if (!timerBadgeInterval) {
    timerBadgeInterval = setInterval(() => aggiornaTimerBadge(), 1000);
  }
}

function formatTempoRimasto(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minuti = Math.floor(totalSeconds / 60);
  const secondi = totalSeconds % 60;
  return `${String(minuti).padStart(2, '0')}:${String(secondi).padStart(2, '0')}`;
}

async function fermaIrrigazioneTutte() {
  const keys = Object.keys(irrigazioneAttiva);
  for (const key of keys) {
    await fermaIrrigazione(key);
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

  // Sincronizza input durata
  try {
    const inputDurata = document.getElementById("durata-irrigazione");
    if (inputDurata && document.activeElement !== inputDurata && typeof INPUT_DURATA_ENTITY !== 'undefined') {
      const durStato = await getStato(INPUT_DURATA_ENTITY);
      if (durStato && durStato.state) {
        inputDurata.value = Math.round(parseFloat(durStato.state));
      }
    }
  } catch(e) {}

  // Update sensor markers on the map
  await aggiornaSensoriMappa();

  // Update pipe animation states
  await aggiornaStatoTubi();

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

const inputDurata = document.getElementById("durata-irrigazione");
if (inputDurata) {
  inputDurata.addEventListener("change", async (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 120) val = 120;
    e.target.value = val;
    try {
      await fetch(`${HA_URL}/api/services/input_number/set_value`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ entity_id: typeof INPUT_DURATA_ENTITY !== 'undefined' ? INPUT_DURATA_ENTITY : 'input_number.durata_irrigazione', value: parseFloat(val) })
      });
    } catch(err) { console.error("Errore salvataggio durata", err); }
  });
}

window.addEventListener('resize', () => {
  creaMappaOrto();
  aggiornaSensoriMappa(); // re-render sensors after resize rebuilds SVG
  aggiornaStatoTubi();    // re-render pipe states after resize rebuilds SVG
});
STAZIONI.forEach((s, i) => creaStazione(s, i));
POMPE.forEach(creaPompa);
aggiornaTutto();
setInterval(aggiornaTutto, 30000);