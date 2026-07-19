/* ============================================================
   ajustes.js — AT El Sotillo Manager · configuración, copias de
   seguridad (export/import JSON) y reinicio.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const UI = window.AgendaUI;

  function render(contenedor) {
    const cfg = S.config();
    contenedor.innerHTML = `
      <h2>Configuración</h2>

      <div class="tarjeta mt">
        <h3 class="tarjeta__titulo">Datos del alojamiento</h3>
        <div class="campos-2 mt-sm">
          <div class="campo"><label>Nombre del negocio</label><input id="cfgNombre" value="${U.escapar(cfg.nombreNegocio || '')}" /></div>
          <div class="campo"><label>Moneda</label><input id="cfgMoneda" value="${U.escapar(cfg.moneda || '€')}" maxlength="4" /></div>
        </div>
        <button class="btn btn--primario" id="cfgGuardar">Guardar</button>
      </div>

      <div class="tarjeta mt" id="tarjetaNube"></div>

      <div class="tarjeta mt">
        <h3 class="tarjeta__titulo">Copias de seguridad</h3>
        <p class="suave" style="font-size:13px">Descarga todos tus datos en un archivo, o restáuralos desde una copia. Guárdalo en un sitio seguro (correo, nube…).</p>
        <div class="fila mt-sm">
          <button class="btn" id="btnExport">⬇️ Descargar copia (JSON)</button>
          <button class="btn" id="btnImport">⬆️ Restaurar copia</button>
          <input type="file" id="inputImport" accept="application/json" hidden />
        </div>
      </div>

      <div class="tarjeta mt">
        <h3 class="tarjeta__titulo" style="color:var(--color-error)">Zona peligrosa</h3>
        <p class="suave" style="font-size:13px">Reinicia con las 7 unidades de El Sotillo y sin reservas.</p>
        <button class="btn btn--peligro" id="btnReset">Reiniciar datos</button>
      </div>

      <p class="tenue mt centro" style="font-size:12px">
        AT El Sotillo Manager · v1 (PWA local-first). Los datos se guardan en este dispositivo.<br>
        La sincronización en la nube (Firebase) y el acceso con usuario llegarán en la siguiente fase.
      </p>
    `;

    pintarNube();
    if (window.AgendaSync) window.AgendaSync.alCambiar(pintarNube);

    document.getElementById('cfgGuardar').onclick = () => {
      S.guardarConfig({ nombreNegocio: document.getElementById('cfgNombre').value.trim() || 'AT El Sotillo', moneda: document.getElementById('cfgMoneda').value.trim() || '€' });
      UI.toast('Configuración guardada', 'exito');
      window.AgendaApp.actualizarCabecera();
    };

    document.getElementById('btnExport').onclick = () => {
      U.descargarArchivo(`copia-elsotillo-${U.hoyISO()}.json`, S.exportarJSON(), 'application/json');
      UI.toast('Copia descargada', 'exito');
    };

    const input = document.getElementById('inputImport');
    document.getElementById('btnImport').onclick = () => input.click();
    input.onchange = () => {
      const archivo = input.files[0];
      if (!archivo) return;
      const lector = new FileReader();
      lector.onload = async () => {
        if (!(await UI.confirmar('Restaurar sustituirá TODOS los datos actuales. ¿Continuar?', 'Restaurar'))) return;
        try {
          S.importarJSON(lector.result);
          UI.toast('Copia restaurada', 'exito');
          window.AgendaApp.actualizarCabecera();
          window.AgendaApp.repintar();
        } catch (err) {
          UI.toast('Archivo no válido', 'error');
        }
      };
      lector.readAsText(archivo);
      input.value = '';
    };

    document.getElementById('btnReset').onclick = async () => {
      if (await UI.confirmar('Esto borrará todas las reservas y clientes. ¿Seguro?', 'Reiniciar')) {
        S.reiniciar();
        UI.toast('Datos reiniciados', 'exito');
        window.AgendaApp.actualizarCabecera();
        window.AgendaApp.repintar();
      }
    };
  }

  // Tarjeta de estado de la sincronización en la nube (Firebase).
  function pintarNube() {
    const cont = document.getElementById('tarjetaNube');
    if (!cont) return;
    const sync = window.AgendaSync;
    if (!sync || !sync.disponible) {
      cont.innerHTML = `
        <h3 class="tarjeta__titulo">☁️ Sincronización en la nube</h3>
        <p class="suave" style="font-size:13px">Inactiva. La agenda se guarda solo en este dispositivo.
        Para compartirla entre móviles/ordenadores y tener login de 2 usuarios, configura Firebase
        (<code>js/firebase-config.js</code>) siguiendo <code>firebase/GUIA-FIREBASE.md</code>.</p>`;
      return;
    }
    const estados = {
      conectando: { icono: '⏳', txt: 'Conectando con la nube…', color: 'var(--color-texto-suave)' },
      'sin-sesion': { icono: '🔒', txt: 'Configurada, sin sesión iniciada.', color: 'var(--color-aviso)' },
      conectado: { icono: '✅', txt: `Sincronizado como <strong>${U.escapar(sync.usuario || '')}</strong>.`, color: 'var(--color-exito)' },
      error: { icono: '⚠️', txt: 'Sin conexión con la nube — trabajando en local.', color: 'var(--color-aviso)' },
      'sin-config': { icono: '☁️', txt: 'Inactiva.', color: 'var(--color-texto-suave)' },
    };
    const e = estados[sync.estado] || estados['sin-config'];
    const boton = sync.estado === 'conectado'
      ? `<button class="btn btn--sm" id="nubeSalir">Cerrar sesión</button>`
      : `<button class="btn btn--sm btn--primario" id="nubeEntrar">Iniciar sesión</button>`;
    cont.innerHTML = `
      <h3 class="tarjeta__titulo">☁️ Sincronización en la nube</h3>
      <p style="font-size:14px;color:${e.color}">${e.icono} ${e.txt}</p>
      <div class="fila mt-sm">${boton}</div>`;
    const entrar = document.getElementById('nubeEntrar');
    const salir = document.getElementById('nubeSalir');
    if (entrar) entrar.onclick = () => sync.abrirLogin();
    if (salir) salir.onclick = async () => { await sync.cerrarSesion(); UI.toast('Sesión cerrada', 'exito'); };
  }

  window.AgendaAjustes = { render };
})();
