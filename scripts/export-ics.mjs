/* ============================================================
   export-ics.mjs — genera un calendario iCal público con las reservas
   MANUALES de la app, para que Airbnb (u otros portales) las importen y
   bloqueen esas fechas.

   Lee las reservas desde Firestore (documento agendas/el-sotillo, que la
   app mantiene sincronizado) usando una cuenta de servicio de Firebase.
   Se ejecuta en GitHub Actions (ver .github/workflows/export-ics.yml).

   IMPORTANTE: excluye las reservas importadas DESDE Airbnb
   (`importadaAirbnb`), para no devolverle a Airbnb sus propias reservas.

   De momento solo exporta el Apartamento 1 (UNIDADES_EXPORTAR).
   ============================================================ */
import { writeFile, mkdir } from 'node:fs/promises';
import admin from 'firebase-admin';

const ESPACIO = 'el-sotillo';                 // documento agendas/{ESPACIO}
const UNIDADES_EXPORTAR = ['apto1'];          // Apartamento 1 (ampliable)
const SALIDA = 'data/apto1.ics';

function aFechaICal(iso) {
  return (iso || '').replace(/-/g, '');
}

function generarICal(reservas) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AT El Sotillo//Manager//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:El Sotillo Manager · Apartamento 1',
  ];
  reservas.forEach((r) => {
    // DTSTAMP estable (fecha de creación) para que el archivo no cambie si la
    // reserva no cambia; así solo se hace commit cuando hay novedades reales.
    const stamp = aFechaICal(r.creada || '2020-01-01') + 'T000000Z';
    const resumen = r.origen === 'bloqueo' ? 'No disponible' : 'Reservado';
    lineas.push('BEGIN:VEVENT');
    lineas.push('UID:' + r.id + '@elsotillo.manager');
    lineas.push('DTSTAMP:' + stamp);
    lineas.push('DTSTART;VALUE=DATE:' + aFechaICal(r.entrada));
    lineas.push('DTEND;VALUE=DATE:' + aFechaICal(r.salida));
    lineas.push('SUMMARY:' + resumen);
    lineas.push('END:VEVENT');
  });
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n') + '\r\n';
}

async function main() {
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cred) {
    console.error('❌ Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(cred)) });
  const db = admin.firestore();

  const snap = await db.collection('agendas').doc(ESPACIO).get();
  const estado = snap.exists ? (snap.data().estado || {}) : {};
  const todas = Array.isArray(estado.reservas) ? estado.reservas : [];

  const reservas = todas
    .filter((r) =>
      r && UNIDADES_EXPORTAR.includes(r.unidadId) &&
      !r.importadaAirbnb &&           // no reexportar lo que vino de Airbnb
      r.estado !== 'cancelada' &&
      r.entrada && r.salida)
    .sort((a, b) => (a.entrada + (a.id || '')).localeCompare(b.entrada + (b.id || '')));

  await mkdir('data', { recursive: true });
  await writeFile(SALIDA, generarICal(reservas), 'utf8');
  console.log(`📝 Escrito ${SALIDA} con ${reservas.length} eventos (de ${todas.length} reservas totales).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
