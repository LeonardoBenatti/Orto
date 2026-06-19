const HEADERS = {
  "Authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

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

function formatOra(iso) {
  const d = new Date(iso);
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Restituisce "appena ora", "5 min fa", "2 ore fa", "3 giorni fa"
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

// Gestisce sia batterie testuali (low/middle/high) sia numeriche (0-100%)
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

// ---- Generazione dinamica delle card per ogni stazione sensori ----
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

    // Usa il last_updated più recente fra temperatura e umidità di questa stazione
    const tStamp = new Date(t.last_updated).getTime();
    const uStamp = new Date(u.last_updated).getTime();
    const piuRecente = tStamp > uStamp ? t.last_updated : u.last_updated;
    document.getElementById(`timestamp-${index}`).textContent = `Aggiornato ${tempoFa(piuRecente)}`;

    return t.last_updated; // usato per il timestamp generale
  } catch (e) {
    return null;
  }
}

// ---- Pompe ----
function creaPompa(pompa) {
  const div = document.createElement("div");
  div.className = "pump-card";
  div.innerHTML = `
    <div class="pump-info">
      <div class="pump-name">💦 ${pompa.nome}</div>
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

// ---- Stato connessione generale ----
function impostaOnline(ultimoAggiornamento) {
  document.getElementById("status-dot").className = "dot";
  document.getElementById("status-text").textContent = "Online";
  document.getElementById("error-msg").style.display = "none";
  if (ultimoAggiornamento) {
    document.getElementById("last-update").textContent = `Aggiornato ${formatOra(ultimoAggiornamento)}`;
  }
}

function impostaOffline() {
  document.getElementById("status-dot").className = "dot offline";
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

// ---- Init ----
STAZIONI.forEach((s, i) => creaStazione(s, i));
POMPE.forEach(creaPompa);
aggiornaTutto();
setInterval(aggiornaTutto, 30000);
