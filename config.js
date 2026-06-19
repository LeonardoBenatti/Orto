// =============================================
// CONFIGURAZIONE PERSONALE — il tuo token va solo qui
// =============================================
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJmNjk4ZjE5ZDdjYWU0MzQyYTdjMjAyNjQwYTk5MGNmYiIsImlhdCI6MTc4MTU2MTc4NiwiZXhwIjoyMDk2OTIxNzg2fQ.8cindAyAurX1yRNrd_z6kdchldnRfd6K_Lkqwfcxf-M";
const HA_URL = ""; // lascia vuoto, usa automaticamente lo stesso host della pagina

// Ogni stazione è un gruppo di sensori con un nome visualizzato.
// Aggiungi nuove stazioni semplicemente copiando un blocco e cambiando i valori.
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

// Pompe: aggiungi o rimuovi voci, metti i nomi entity_id esatti
const POMPE = [
  { nome: "Pompa 1", entity_id: "switch.pompa_1" },
  { nome: "Pompa 2", entity_id: "switch.pompa_2" },
];
