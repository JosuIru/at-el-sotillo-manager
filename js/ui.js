/* ============================================================
   ui.js — helpers de interfaz compartidos: modal, toasts,
   insignias de estado y confirmaciones. window.AgendaUI.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;

  const overlay = () => document.getElementById('modalOverlay');
  const tituloEl = () => document.getElementById('modalTitulo');
  const cuerpoEl = () => document.getElementById('modalCuerpo');

  function abrirModal(titulo, htmlCuerpo) {
    tituloEl().textContent = titulo;
    cuerpoEl().innerHTML = htmlCuerpo;
    overlay().hidden = false;
    document.body.style.overflow = 'hidden';
    // Foco al primer campo si lo hay.
    const primerCampo = cuerpoEl().querySelector('input, select, textarea, button');
    if (primerCampo) setTimeout(() => primerCampo.focus(), 30);
  }

  function cerrarModal() {
    overlay().hidden = true;
    cuerpoEl().innerHTML = '';
    document.body.style.overflow = '';
  }

  function toast(mensaje, tipo) {
    const stack = document.getElementById('toastStack');
    const nodo = U.crearNodo(`<div class="toast toast--${tipo || 'info'}">${U.escapar(mensaje)}</div>`);
    stack.appendChild(nodo);
    setTimeout(() => {
      nodo.style.opacity = '0';
      nodo.style.transition = 'opacity .3s';
      setTimeout(() => nodo.remove(), 300);
    }, 2800);
  }

  // Confirmación con promesa (sustituye a window.confirm, más bonita).
  function confirmar(mensaje, textoBoton) {
    return new Promise((resolve) => {
      abrirModal('Confirmar', `
        <p style="margin:0 0 16px">${U.escapar(mensaje)}</p>
        <div class="modal__pie">
          <button class="btn" id="confCancelar">Cancelar</button>
          <button class="btn btn--peligro" id="confAceptar">${U.escapar(textoBoton || 'Eliminar')}</button>
        </div>
      `);
      document.getElementById('confCancelar').onclick = () => { cerrarModal(); resolve(false); };
      document.getElementById('confAceptar').onclick = () => { cerrarModal(); resolve(true); };
    });
  }

  function insignia(estadoId) {
    const def = S.ESTADOS_RESERVA.find((e) => e.id === estadoId) || S.ESTADOS_RESERVA[0];
    return `<span class="insignia insignia--${def.id}">${def.icono} ${def.etiqueta}</span>`;
  }

  window.AgendaUI = { abrirModal, cerrarModal, toast, confirmar, insignia };
})();
