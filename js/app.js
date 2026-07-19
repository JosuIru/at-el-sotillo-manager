/* ============================================================
   app.js — AT El Sotillo Manager · arranque y enrutado de vistas.
   ============================================================ */
(function () {
  'use strict';

  const S = window.AgendaStore;

  const VISTAS = {
    panel: () => window.AgendaPanel,
    calendario: () => window.AgendaCalendario,
    reservas: () => window.AgendaReservas,
    clientes: () => window.AgendaClientes,
    limpieza: () => window.AgendaLimpieza,
    estadisticas: () => window.AgendaEstadisticas,
    alojamientos: () => window.AgendaAlojamientos,
    ajustes: () => window.AgendaAjustes,
  };

  let vistaActual = 'panel';

  function irA(vista) {
    if (!VISTAS[vista]) vista = 'panel';
    vistaActual = vista;
    document.querySelectorAll('.app-nav__item').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.vista === vista);
    });
    document.getElementById('navPrincipal').classList.remove('is-open');
    repintar();
    window.scrollTo(0, 0);
  }

  function repintar() {
    const contenedor = document.getElementById('vista');
    const modulo = VISTAS[vistaActual]();
    if (modulo && modulo.render) modulo.render(contenedor);
  }

  function actualizarCabecera() {
    document.getElementById('alojamientoNombre').textContent = S.config().nombreNegocio || 'Gestión de reservas';
    document.title = `${S.config().nombreNegocio || 'AT El Sotillo'} · Manager`;
  }

  function init() {
    S.cargar();
    actualizarCabecera();

    document.getElementById('navPrincipal').addEventListener('click', (e) => {
      const item = e.target.closest('.app-nav__item');
      if (item) irA(item.dataset.vista);
    });

    document.getElementById('menuToggle').onclick = () => {
      document.getElementById('navPrincipal').classList.toggle('is-open');
    };

    // Modal: cerrar con overlay, botón X o Escape.
    const overlay = document.getElementById('modalOverlay');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) window.AgendaUI.cerrarModal(); });
    document.getElementById('modalCerrar').onclick = window.AgendaUI.cerrarModal;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) window.AgendaUI.cerrarModal(); });

    irA('panel');

    // PWA: registrar service worker (solo sobre http/https, no en file://).
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW no registrado:', err));
    }
  }

  window.AgendaApp = { irA, repintar, actualizarCabecera };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
