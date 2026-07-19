/* ============================================================
   sync-airbnb.mjs — descarga los calendarios iCal de Airbnb y genera
   data/airbnb.json con las reservas, para que la app las importe.

   Se ejecuta en GitHub Actions (ver .github/workflows/sync-airbnb.yml).
   Las URLs iCal son privadas y se leen de secretos del repositorio; NUNCA
   se escriben en el código ni en el JSON de salida.

   Uso local (opcional):
     AIRBNB_ICAL_APTO1="https://..." AIRBNB_ICAL_SOTILLO2="https://..." \
       node scripts/sync-airbnb.mjs
   ============================================================ */
import { writeFile, mkdir } from 'node:fs/promises';

// Correspondencia anuncio de Airbnb → unidad de la app. La URL de cada uno
// se pasa como variable de entorno (secreto), no va aquí.
const FEEDS = [
  { unidadId: 'apto1', env: 'AIRBNB_ICAL_APTO1' },
  { unidadId: 'sotillo2', env: 'AIRBNB_ICAL_SOTILLO2' },
];

const SALIDA = 'data/airbnb.json';

// Palabras que indican un bloqueo (no una reserva de huésped).
function esBloqueoPorResumen(resumen) {
  const t = (resumen || '').toLowerCase();
  return t.includes('not available') || t.includes('no disponible') ||
         t.includes('unavailable') || t.includes('blocked');
}

// Desdobla líneas plegadas de iCal (una línea que sigue empieza por espacio/tab).
function desdoblar(texto) {
  return texto.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

// Extrae 'YYYYMMDD...' → 'YYYY-MM-DD'.
function aFechaISO(valor) {
  const m = (valor || '').match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function parsearICal(texto, unidadId) {
  const lineas = desdoblar(texto).split(/\r?\n/);
  const reservas = [];
  let ev = null;
  for (const linea of lineas) {
    if (linea === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (linea === 'END:VEVENT') {
      if (ev && ev.uid && ev.entrada && ev.salida) {
        reservas.push({
          uid: ev.uid,
          unidadId,
          entrada: ev.entrada,
          salida: ev.salida,
          tipo: esBloqueoPorResumen(ev.summary) ? 'bloqueo' : 'reserva',
        });
      }
      ev = null;
      continue;
    }
    if (!ev) continue;
    const idx = linea.indexOf(':');
    if (idx === -1) continue;
    const clave = linea.slice(0, idx).split(';')[0].toUpperCase();
    const valor = linea.slice(idx + 1).trim();
    if (clave === 'UID') ev.uid = valor;
    else if (clave === 'DTSTART') ev.entrada = aFechaISO(valor);
    else if (clave === 'DTEND') ev.salida = aFechaISO(valor);
    else if (clave === 'SUMMARY') ev.summary = valor;
  }
  return reservas;
}

async function main() {
  const todas = [];
  for (const feed of FEEDS) {
    const url = process.env[feed.env];
    if (!url) {
      console.warn(`⚠️  Falta el secreto ${feed.env}; se omite ${feed.unidadId}.`);
      continue;
    }
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'ElSotilloManager/1.0' } });
      if (!resp.ok) {
        console.error(`❌ ${feed.unidadId}: HTTP ${resp.status}`);
        continue;
      }
      const texto = await resp.text();
      const reservas = parsearICal(texto, feed.unidadId);
      console.log(`✔ ${feed.unidadId}: ${reservas.length} eventos.`);
      todas.push(...reservas);
    } catch (err) {
      console.error(`❌ ${feed.unidadId}:`, err.message);
    }
  }

  // Orden estable para que el JSON no cambie si los datos no cambian.
  todas.sort((a, b) => (a.entrada + a.uid).localeCompare(b.entrada + b.uid));

  const contenido = {
    fuente: 'airbnb-ical',
    reservas: todas,
  };

  await mkdir('data', { recursive: true });
  await writeFile(SALIDA, JSON.stringify(contenido, null, 2) + '\n', 'utf8');
  console.log(`📝 Escrito ${SALIDA} con ${todas.length} reservas.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
