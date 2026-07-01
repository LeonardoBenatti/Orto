// =============================================
// CONFIGURAZIONE PERSONALE
// =============================================
const HA_URL = ""; // lascia vuoto, usa automaticamente lo stesso host della pagina

// Ogni stazione è un gruppo di sensori con un nome visualizzato.
const STAZIONI = [
  {
    nome: "Orto Esterno",
    temperatura: "sensor.th_orto_esterno_temperatura",
    umidita:     "sensor.th_orto_esterno_umidita",
    batteria:    "sensor.th_orto_esterno_stato_della_batteria", // testo: low/middle/high
  },
  {
    nome: "Sensore01",
    temperatura: "sensor.orto_sensore01_temperatura",
    umidita:     "sensor.orto_sensore01_umidita",
    batteria:    "sensor.orto_sensore01_batteria", // verifica se è testo o numero
  },
  {
    nome: "Sensore02",
    temperatura: "sensor.orto_sensore02_temperatura",
    umidita:     "sensor.orto_sensore02_umidita",
    batteria:    "sensor.orto_sensore02_batteria", // verifica se è testo o numero
  },
  {
    nome: "Sensore03",
    temperatura: "sensor.orto_sensore03_temperatura",
    umidita:     "sensor.orto_sensore03_umidita",
    batteria:    "sensor.orto_sensore03_batteria", // verifica se è testo o numero
  },
  {
    nome: "Sensore04",
    temperatura: "sensor.orto_sensore04_temperatura",
    umidita:     "sensor.orto_sensore04_umidita",
    batteria:    "sensor.orto_sensore04_batteria", // verifica se è testo o numero
  },
  {
    nome: "Soil Fertility",
    temperatura: "sensor.soil_fertility_sensor_temperatura",
    umidita:     "sensor.soil_fertility_sensor_umidita",
    batteria:    "sensor.soil_fertility_sensor_batteria", // verifica se è testo o numero
  },
];

// =============================================
// SENSORI SULLA MAPPA
// =============================================
// Mappa sensori → tutte le aiuole grandi (Aiuola 1, 2, 3, 4).
// Ogni aiuola ha 3 slot (alto, centro, basso).
// Imposta "stationIndex" all'indice della stazione in STAZIONI per assegnare un sensore.
// Imposta null per lasciare lo slot vuoto (pronto per il futuro).
//
// Esempio: stationIndex: 1 → usa STAZIONI[1] cioè "Sensore01"
const SENSORI_MAPPA = {
  // Aiuola 1 (a sinistra, 5.2m x 1m)
  aiuola1: [
    { slot: "alto",   stationIndex: null },
    { slot: "centro", stationIndex: null },
    { slot: "basso",  stationIndex: null },
  ],
  // Aiuola 2 (prima grande a destra)
  aiuola2: [
    { slot: "alto",   stationIndex: null },
    { slot: "centro", stationIndex: 2 },
    { slot: "basso",  stationIndex: null },
  ],
  // Aiuola 3 (seconda grande a destra)
  aiuola3: [
    { slot: "alto",   stationIndex: null },
    { slot: "centro", stationIndex: null },
    { slot: "basso",  stationIndex: 5 },
  ],
  // Aiuola 4 (terza grande a destra)
  aiuola4: [
    { slot: "alto",   stationIndex: null },
    { slot: "centro", stationIndex: null },
    { slot: "basso",  stationIndex: null },
  ],
};

const ICONA_RICIRCOLO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const ICONA_RUBINETTO = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
const ICONA_IRRIGAZIONE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`;
const ICONA_VALVOLA = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M12 12v-6"/><path d="M9 6h6"/></svg>`;
const ICONA_INVERTER = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

const POMPE = [
  { nome: "Alimentazione Inverter", entity_id: "switch.orto_comandi_orto_alimentazione_inverter", icona: ICONA_INVERTER },
  { nome: "Ricircolo botte", entity_id: "switch.comandi_orto_ricircolo_acqua", icona: ICONA_RICIRCOLO },
  { nome: "Rubinetto botte", entity_id: "switch.orto_comandi_orto_rubinetto_botte", icona: ICONA_RUBINETTO },
  { nome: "Pompa irrigazione", entity_id: "switch.orto_comandi_orto_pompa_irrigazione", icona: ICONA_IRRIGAZIONE },
  { nome: "Valvola Aiuola 1", entity_id: "valve.timer_acqua_rf_valve_1", icona: ICONA_VALVOLA },
  { nome: "Valvola Aiuola 2", entity_id: "valve.timer_acqua_rf_valve_2", icona: ICONA_VALVOLA },
  { nome: "Valvola Aiuola 3", entity_id: "valve.timer_acqua_rf_valve_3", icona: ICONA_VALVOLA },
  { nome: "Valvola Aiuola 4", entity_id: "valve.timer_acqua_rf_valve_4", icona: ICONA_VALVOLA },
];

