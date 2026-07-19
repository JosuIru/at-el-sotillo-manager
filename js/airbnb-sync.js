/* ============================================================
   airbnb-sync.js — AT El Sotillo Manager · importación del calendario
   de Airbnb (y cualquier iCal) hacia la agenda.

   Cómo funciona (sin servidor propio):
     · Un proceso programado en GitHub Actions descarga los calendarios
       iCal de Airbnb cada hora y guarda las reservas en data/airbnb.json.
     · Este módulo lee ese archivo (mismo origen → sin problemas de CORS)
       y las concilia en la agenda con AgendaStore.sincronizarAirbnb().

   Las reservas importadas se pintan en el calendario (rosa 🩷), bloquean
   la disponibilidad igual que una reserva normal (incluida la función
   estrella) y aparecen en Limpieza. Son de solo lectura: no se pueden
   editar ni borrar a mano; se actualizan solas cuando cambia Airbnb.
   ============================================================ */
(function () {
  'use strict';

  const S = window.AgendaStore;
  const RUTA = './data/airbnb.json';

  async function sincronizar() {
    if (!S || !S.obtener()) return; // el estado aún no está cargado
    try {
      const resp = await fetch(RUTA, { cache: 'no-cache' });
      if (!resp.ok) return; // aún no se ha generado el archivo: nada que hacer
      const datos = await resp.json();
      const cambios = S.sincronizarAirbnb(datos.reservas || []);
      if (cambios > 0 && window.AgendaApp) {
        window.AgendaApp.repintar();
      }
    } catch (err) {
      // Sin conexión o archivo no disponible: se conserva lo ya sincronizado.
      console.warn('No se pudo sincronizar con Airbnb (se sigue con lo local):', err);
    }
  }

  // Reintento periódico por si la app queda abierta mucho tiempo (Airbnb se
  // actualiza en el servidor cada hora).
  const CADA_30_MIN = 30 * 60 * 1000;
  setInterval(sincronizar, CADA_30_MIN);

  window.AgendaAirbnb = { sincronizar };
})();
