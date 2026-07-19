/* ============================================================
   alojamientos.js — AT El Sotillo Manager · gestión de unidades.
   Permite definir qué habitaciones ocupa una "Casa completa"
   (campo `componentes`), que es lo que activa la función estrella.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const UI = window.AgendaUI;

  function render(contenedor) {
    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Unidades de alojamiento</h2>
        <button class="btn btn--primario btn--grande" id="btnNuevaUnidad">➕ Nueva unidad</button>
      </div>
      <p class="suave mt-sm">Una <strong>Casa completa</strong> puede bloquear varias habitaciones: al reservarla, esas habitaciones quedan ocupadas automáticamente (y al revés).</p>
      <div class="grid mt" id="listaUnidades" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"></div>
    `;
    document.getElementById('btnNuevaUnidad').onclick = () => abrirFormulario(null);
    pintar();
  }

  function pintar() {
    const cont = document.getElementById('listaUnidades');
    const unidades = S.unidades();
    if (!unidades.length) {
      cont.innerHTML = `<div class="vacio"><div class="vacio__icono">🛏️</div>Sin unidades.</div>`;
      return;
    }
    cont.innerHTML = unidades.map(tarjeta).join('');
    cont.querySelectorAll('[data-editar]').forEach((b) => { b.onclick = () => abrirFormulario(b.dataset.editar); });
    cont.querySelectorAll('[data-borrar]').forEach((b) => {
      b.onclick = async () => {
        const tieneReservas = S.reservas().some((r) => r.unidadId === b.dataset.borrar);
        const msg = tieneReservas
          ? 'Esta unidad tiene reservas asociadas. Si la eliminas, esas reservas quedarán sin unidad. ¿Continuar?'
          : '¿Eliminar esta unidad?';
        if (await UI.confirmar(msg)) { S.eliminarUnidad(b.dataset.borrar); UI.toast('Unidad eliminada', 'exito'); pintar(); }
      };
    });
  }

  function tarjeta(u) {
    const compuesta = u.componentes && u.componentes.length;
    const nombresComp = (u.componentes || []).map((c) => (S.unidadPorId(c) || {}).nombre).filter(Boolean);
    return `<div class="tarjeta">
      <div class="fila fila--between">
        <h3 style="margin:0">${U.escapar(u.nombre)}</h3>
        <span class="chip">${U.escapar(u.tipo || '—')}</span>
      </div>
      <div class="suave mt-sm" style="font-size:13px">
        👥 ${u.capacidad || '?'} pers · 💶 ${U.formatoDinero(u.precioBase || 0, S.moneda())}/noche
      </div>
      ${compuesta ? `<div class="aviso-info mt-sm">🏠 Al reservar bloquea: <strong>${U.escapar(nombresComp.join(', '))}</strong></div>` : ''}
      <div class="tabla__acciones mt">
        <button class="btn btn--sm" data-editar="${u.id}">✏️ Editar</button>
        <button class="btn btn--sm btn--fantasma" data-borrar="${u.id}">🗑️</button>
      </div>
    </div>`;
  }

  function abrirFormulario(id) {
    const u = id ? S.unidadPorId(id) : null;
    const otras = S.unidades().filter((x) => x.id !== id);
    const compActuales = (u && u.componentes) || [];

    UI.abrirModal(id ? 'Editar unidad' : 'Nueva unidad', `
      <form id="formUnidad">
        <div class="campo"><label>Nombre *</label><input name="nombre" required value="${U.escapar(u ? u.nombre : '')}" placeholder="Ej. Habitación 1" /></div>
        <div class="campos-2">
          <div class="campo"><label>Tipo</label>
            <select name="tipo">${S.TIPOS_UNIDAD.map((t) => `<option ${u && u.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="campo"><label>Capacidad (pers.)</label><input name="capacidad" type="number" min="1" value="${u ? u.capacidad : 2}" /></div>
        </div>
        <div class="campo"><label>Precio base por noche (${S.moneda()})</label><input name="precioBase" type="number" min="0" step="0.01" value="${u ? u.precioBase : ''}" placeholder="0" /></div>

        <div class="campo">
          <label>Habitaciones que bloquea (para casas completas)</label>
          <span class="campo__ayuda">Marca las unidades que quedan ocupadas al reservar ésta. Déjalo vacío si es independiente.</span>
          <div class="lista-check mt-sm">
            ${otras.length ? otras.map((x) => `
              <label class="check-item">
                <input type="checkbox" name="comp" value="${x.id}" ${compActuales.includes(x.id) ? 'checked' : ''} />
                ${U.escapar(x.nombre)} <span class="tenue">(${U.escapar(x.tipo || '')})</span>
              </label>`).join('') : '<span class="tenue">No hay otras unidades.</span>'}
          </div>
        </div>

        <div class="modal__pie">
          <button type="button" class="btn" id="unidadCancelar">Cancelar</button>
          <button type="submit" class="btn btn--primario btn--grande">${id ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `);
    document.getElementById('unidadCancelar').onclick = UI.cerrarModal;
    document.getElementById('formUnidad').onsubmit = (e) => {
      e.preventDefault();
      const form = e.target;
      const componentes = [...form.querySelectorAll('input[name="comp"]:checked')].map((c) => c.value);
      const datos = {
        nombre: form.nombre.value.trim(),
        tipo: form.tipo.value,
        capacidad: Number(form.capacidad.value) || 1,
        precioBase: Number(form.precioBase.value) || 0,
        componentes,
      };
      if (!datos.nombre) { UI.toast('Falta el nombre', 'error'); return; }
      if (id) datos.id = id;
      S.guardarUnidad(datos);
      UI.toast('Unidad guardada', 'exito');
      UI.cerrarModal();
      window.AgendaApp.repintar();
    };
  }

  window.AgendaAlojamientos = { render };
})();
