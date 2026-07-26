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

  /* ---- Scroll de fondo y teclado del móvil -------------------------------
     En iOS `body { overflow: hidden }` no basta: hay que fijar el body para
     que el gesto no arrastre la página de detrás del modal. Y cuando aparece
     el teclado el viewport visible se encoge sin que cambie el layout, así que
     ajustamos la altura del overlay a `visualViewport` para que el pie del
     formulario (botón de guardar) siga siendo alcanzable.                    */
  let posicionScrollGuardada = 0;

  function bloquearScrollFondo() {
    posicionScrollGuardada = window.scrollY || window.pageYOffset || 0;
    const estilosBody = document.body.style;
    estilosBody.position = 'fixed';
    estilosBody.top = `-${posicionScrollGuardada}px`;
    estilosBody.left = '0';
    estilosBody.right = '0';
    estilosBody.width = '100%';
    estilosBody.overflow = 'hidden';
  }

  function liberarScrollFondo() {
    const estilosBody = document.body.style;
    estilosBody.position = '';
    estilosBody.top = '';
    estilosBody.left = '';
    estilosBody.right = '';
    estilosBody.width = '';
    estilosBody.overflow = '';
    window.scrollTo(0, posicionScrollGuardada);
  }

  function ajustarOverlayAlVisualViewport() {
    const viewportVisible = window.visualViewport;
    const capa = overlay();
    if (!viewportVisible || !capa || capa.hidden) return;
    capa.style.height = `${viewportVisible.height}px`;
    capa.style.transform = `translateY(${viewportVisible.offsetTop}px)`;
  }

  function restaurarAlturaOverlay() {
    const capa = overlay();
    if (!capa) return;
    capa.style.height = '';
    capa.style.transform = '';
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', ajustarOverlayAlVisualViewport);
    window.visualViewport.addEventListener('scroll', ajustarOverlayAlVisualViewport);
  }

  function abrirModal(titulo, htmlCuerpo) {
    tituloEl().textContent = titulo;
    cuerpoEl().innerHTML = htmlCuerpo;
    cuerpoEl().scrollTop = 0;
    overlay().hidden = false;
    bloquearScrollFondo();
    ajustarOverlayAlVisualViewport();
    // Foco al primer campo si lo hay. En móvil no, para que el teclado no tape
    // el formulario nada más abrirlo.
    const esPantallaPequena = window.matchMedia('(max-width: 780px)').matches;
    const primerCampo = cuerpoEl().querySelector('input, select, textarea, button');
    if (primerCampo && !esPantallaPequena) setTimeout(() => primerCampo.focus(), 30);
  }

  function cerrarModal() {
    overlay().hidden = true;
    cuerpoEl().innerHTML = '';
    restaurarAlturaOverlay();
    liberarScrollFondo();
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
