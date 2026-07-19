/* ============================================================
   clientes.js — AT El Sotillo Manager · directorio de clientes.
   Nombre, teléfono, observaciones + historial de reservas.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;
  const UI = window.AgendaUI;

  let busqueda = '';

  function render(contenedor) {
    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Clientes</h2>
        <button class="btn btn--primario btn--grande" id="btnNuevoCliente">➕ Nuevo cliente</button>
      </div>
      <div class="barra-herramientas mt">
        <input class="buscador" id="buscadorClientes" placeholder="🔍 Buscar cliente…" value="${U.escapar(busqueda)}" />
      </div>
      <div id="listaClientes"></div>
    `;
    document.getElementById('btnNuevoCliente').onclick = () => abrirFormulario(null);
    const buscador = document.getElementById('buscadorClientes');
    buscador.oninput = () => { busqueda = buscador.value; pintar(); };
    pintar();
  }

  function pintar() {
    const cont = document.getElementById('listaClientes');
    const t = busqueda.trim().toLowerCase();
    const lista = S.clientes()
      .filter((c) => !t || `${c.nombre} ${c.telefono}`.toLowerCase().includes(t))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (!lista.length) {
      cont.innerHTML = `<div class="vacio"><div class="vacio__icono">👥</div>Sin clientes todavía.</div>`;
      return;
    }
    cont.innerHTML = `<div class="tabla-wrap mt"><table class="tabla tabla--clic">
      <thead><tr><th>Nombre</th><th>Teléfono</th><th class="centro">Reservas</th><th>Observaciones</th><th></th></tr></thead>
      <tbody>${lista.map(fila).join('')}</tbody></table></div>`;

    cont.querySelectorAll('tbody tr').forEach((tr) => {
      tr.onclick = (e) => { if (!e.target.closest('.tabla__acciones')) verFicha(tr.dataset.id); };
    });
    cont.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); abrirFormulario(b.dataset.editar); };
    });
    cont.querySelectorAll('[data-borrar]').forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        if (await UI.confirmar('¿Eliminar este cliente del directorio? Sus reservas se conservan.')) {
          S.eliminarCliente(b.dataset.borrar); UI.toast('Cliente eliminado', 'exito'); pintar();
        }
      };
    });
  }

  function fila(c) {
    const n = M.reservasDeCliente(c.nombre).length;
    return `<tr data-id="${c.id}">
      <td><strong>${U.escapar(c.nombre)}</strong></td>
      <td>${c.telefono ? `<a href="tel:${U.escapar(c.telefono)}" onclick="event.stopPropagation()">${U.escapar(c.telefono)}</a>` : '<span class="tenue">—</span>'}</td>
      <td class="centro">${n}</td>
      <td class="suave">${U.escapar(c.observaciones || '')}</td>
      <td><div class="tabla__acciones">
        <button class="btn btn--sm btn--fantasma" data-editar="${c.id}">✏️</button>
        <button class="btn btn--sm btn--fantasma" data-borrar="${c.id}">🗑️</button>
      </div></td>
    </tr>`;
  }

  function verFicha(id) {
    const c = S.clientePorId(id);
    if (!c) return;
    const reservas = M.reservasDeCliente(c.nombre);
    UI.abrirModal(c.nombre, `
      ${c.telefono ? `<div class="detalle-fila"><span class="detalle-fila__k">Teléfono</span><span class="detalle-fila__v"><a href="tel:${U.escapar(c.telefono)}">${U.escapar(c.telefono)}</a></span></div>` : ''}
      ${c.observaciones ? `<div class="detalle-fila"><span class="detalle-fila__k">Observaciones</span><span class="detalle-fila__v">${U.escapar(c.observaciones)}</span></div>` : ''}
      <h3 class="mt">Historial (${reservas.length})</h3>
      ${reservas.length ? `<div class="lista-eventos">${reservas.map((r) => {
        const u = S.unidadPorId(r.unidadId);
        return `<div class="evento" data-reserva="${r.id}" style="cursor:pointer">
          <div class="evento__cuerpo">
            <div class="evento__nombre">${u ? U.escapar(u.nombre) : '—'}</div>
            <div class="evento__detalle">${U.formatoCorto(r.entrada)} → ${U.formatoCorto(r.salida)} · ${U.formatoDinero(r.precioTotal, S.moneda())}</div>
          </div>
          <span class="punto" style="background:${S.origen(r.origen).color}"></span>
        </div>`;
      }).join('')}</div>` : '<p class="tenue">Sin reservas.</p>'}
      <div class="modal__pie mt"><button class="btn btn--primario" id="fichaEditar">✏️ Editar</button></div>
    `);
    UI.abrirModal && document.getElementById('fichaEditar') && (document.getElementById('fichaEditar').onclick = () => abrirFormulario(id));
    document.querySelectorAll('#modalCuerpo [data-reserva]').forEach((el) => {
      el.onclick = () => window.AgendaReservas.verDetalle(el.dataset.reserva);
    });
  }

  function abrirFormulario(id) {
    const c = id ? S.clientePorId(id) : null;
    UI.abrirModal(id ? 'Editar cliente' : 'Nuevo cliente', `
      <form id="formCliente">
        <div class="campo"><label>Nombre *</label><input name="nombre" required value="${U.escapar(c ? c.nombre : '')}" /></div>
        <div class="campo"><label>Teléfono</label><input name="telefono" value="${U.escapar(c ? c.telefono : '')}" placeholder="+34 …" /></div>
        <div class="campo"><label>Observaciones</label><textarea name="observaciones" placeholder="Alergias, preferencias, notas…">${U.escapar(c ? c.observaciones : '')}</textarea></div>
        <div class="modal__pie">
          <button type="button" class="btn" id="clienteCancelar">Cancelar</button>
          <button type="submit" class="btn btn--primario btn--grande">${id ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    `);
    document.getElementById('clienteCancelar').onclick = UI.cerrarModal;
    document.getElementById('formCliente').onsubmit = (e) => {
      e.preventDefault();
      const form = e.target;
      const datos = { nombre: form.nombre.value.trim(), telefono: form.telefono.value.trim(), observaciones: form.observaciones.value.trim() };
      if (!datos.nombre) { UI.toast('Falta el nombre', 'error'); return; }
      if (id) datos.id = id;
      S.guardarCliente(datos);
      UI.toast('Cliente guardado', 'exito');
      UI.cerrarModal();
      window.AgendaApp.repintar();
    };
  }

  window.AgendaClientes = { render };
})();
