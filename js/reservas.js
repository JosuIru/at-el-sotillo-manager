/* ============================================================
   reservas.js — AT El Sotillo Manager · listado + formulario de
   reserva/bloqueo + ficha de detalle.

   REGLA CLAVE: si hay solape (incluido el bloqueo compuesto casa↔habitaciones)
   el formulario NO deja guardar. window.AgendaReservas.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;
  const UI = window.AgendaUI;

  const filtro = { texto: '', origen: 'todas', unidadId: 'todas' };

  // ---------------------------------------------------------
  // Vista: listado de reservas
  // ---------------------------------------------------------
  function render(contenedor) {
    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Reservas</h2>
        <button class="btn btn--primario btn--grande" id="btnNuevaReserva">➕ Nueva reserva</button>
      </div>

      <div class="barra-herramientas mt">
        <input class="buscador" id="buscadorReservas" placeholder="🔍 Buscar cliente, teléfono…" value="${U.escapar(filtro.texto)}" />
        <select id="filtroUnidad">
          <option value="todas">Todas las unidades</option>
          ${S.unidades().map((u) => `<option value="${u.id}" ${filtro.unidadId === u.id ? 'selected' : ''}>${U.escapar(u.nombre)}</option>`).join('')}
        </select>
        <div class="chip-filtros" id="chipsOrigen">
          ${chip('todas', 'Todas')}
          ${S.ORIGENES.map((o) => chip(o.id, `${o.emoji} ${o.etiqueta}`)).join('')}
        </div>
        <button class="btn btn--sm" id="btnExportCSV">⬇️ CSV</button>
      </div>

      <div id="listaReservas"></div>
    `;

    document.getElementById('btnNuevaReserva').onclick = () => abrirFormulario(null);
    document.getElementById('btnExportCSV').onclick = exportarCSV;

    const buscador = document.getElementById('buscadorReservas');
    buscador.oninput = () => { filtro.texto = buscador.value; pintarLista(); };
    document.getElementById('filtroUnidad').onchange = (e) => { filtro.unidadId = e.target.value; pintarLista(); };
    document.getElementById('chipsOrigen').addEventListener('click', (e) => {
      const chipEl = e.target.closest('.chip');
      if (!chipEl) return;
      filtro.origen = chipEl.dataset.valor;
      render(contenedor);
    });

    pintarLista();
  }

  function chip(valor, etiqueta) {
    return `<button class="chip ${filtro.origen === valor ? 'is-active' : ''}" data-valor="${valor}">${U.escapar(etiqueta)}</button>`;
  }

  function reservasFiltradas() {
    const t = filtro.texto.trim().toLowerCase();
    return S.reservas()
      .filter((r) => {
        if (filtro.origen !== 'todas' && r.origen !== filtro.origen) return false;
        if (filtro.unidadId !== 'todas' && r.unidadId !== filtro.unidadId) return false;
        if (t && !`${r.cliente} ${r.telefono} ${r.observaciones}`.toLowerCase().includes(t)) return false;
        return true;
      })
      .sort((a, b) => b.entrada.localeCompare(a.entrada));
  }

  function pintarLista() {
    const cont = document.getElementById('listaReservas');
    const lista = reservasFiltradas();
    if (!lista.length) {
      cont.innerHTML = `<div class="vacio"><div class="vacio__icono">📭</div>No hay reservas que coincidan.</div>`;
      return;
    }
    cont.innerHTML = `
      <div class="tabla-wrap mt">
        <table class="tabla tabla--clic">
          <thead><tr>
            <th>Cliente</th><th>Alojamiento</th><th>Entrada</th><th>Salida</th>
            <th class="centro">Noches</th><th>Pago</th><th class="nowrap">Precio</th><th></th>
          </tr></thead>
          <tbody>${lista.map(fila).join('')}</tbody>
        </table>
      </div>`;

    cont.querySelectorAll('tbody tr').forEach((tr) => {
      tr.onclick = (e) => { if (!e.target.closest('.tabla__acciones')) verDetalle(tr.dataset.id); };
    });
    cont.querySelectorAll('[data-editar]').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); abrirFormulario(b.dataset.editar); };
    });
    cont.querySelectorAll('[data-borrar]').forEach((b) => {
      b.onclick = async (e) => {
        e.stopPropagation();
        if (await UI.confirmar('¿Eliminar esta reserva?')) {
          S.eliminarReserva(b.dataset.borrar); UI.toast('Reserva eliminada', 'exito'); pintarLista();
        }
      };
    });
  }

  function fila(r) {
    const unidad = S.unidadPorId(r.unidadId);
    const ori = S.origen(r.origen);
    const esBloqueo = r.origen === 'bloqueo';
    return `
      <tr data-id="${r.id}">
        <td>
          <span class="punto" style="background:${ori.color}"></span>
          <strong>${esBloqueo ? '🔒 ' + (U.escapar(r.observaciones) || 'Bloqueado') : U.escapar(r.cliente) || '—'}</strong>
          <div class="tenue" style="font-size:12px">${ori.emoji} ${ori.etiqueta}${!esBloqueo ? ` · ${r.personas || 1} pers.` : ''}</div>
        </td>
        <td>${unidad ? U.escapar(unidad.nombre) : '<span class="tenue">—</span>'}</td>
        <td class="nowrap">${U.formatoCorto(r.entrada)}</td>
        <td class="nowrap">${U.formatoCorto(r.salida)}</td>
        <td class="centro">${U.noches(r.entrada, r.salida)}</td>
        <td>${esBloqueo ? '<span class="tenue">—</span>' : insigniaPago(r)}</td>
        <td class="nowrap">${esBloqueo ? '—' : U.formatoDinero(r.precioTotal, S.moneda())}</td>
        <td><div class="tabla__acciones">
          ${r.importadaAirbnb ? '<span class="tenue" title="Importada de Airbnb (solo lectura)">🔗</span>' : `
          <button class="btn btn--sm btn--fantasma" data-editar="${r.id}" title="Editar">✏️</button>
          <button class="btn btn--sm btn--fantasma" data-borrar="${r.id}" title="Eliminar">🗑️</button>`}
        </div></td>
      </tr>`;
  }

  function insigniaPago(r) {
    const ep = S.estadoPago(r.estadoPago);
    const saldo = M.saldo(r);
    const txt = ep.id === 'parcial' && saldo > 0 ? `Anticipo · falta ${U.formatoDinero(saldo, S.moneda())}` : ep.etiqueta;
    return `<span class="insignia" style="background:transparent;color:${ep.color};border:1px solid currentColor">${txt}</span>`;
  }

  // ---------------------------------------------------------
  // Ficha de detalle
  // ---------------------------------------------------------
  function verDetalle(id) {
    const r = S.reservaPorId(id);
    if (!r) return;
    const unidad = S.unidadPorId(r.unidadId);
    const ori = S.origen(r.origen);
    const esBloqueo = r.origen === 'bloqueo';
    const esAirbnb = !!r.importadaAirbnb;
    const f = (k, v) => `<div class="detalle-fila"><span class="detalle-fila__k">${k}</span><span class="detalle-fila__v">${v}</span></div>`;

    // Las reservas importadas de Airbnb son de solo lectura (se actualizan solas).
    const pie = esAirbnb
      ? `<p class="suave" style="font-size:13px;margin-top:16px">🔗 Importada de Airbnb. Se sincroniza automáticamente y no se puede editar aquí.</p>`
      : `<div class="modal__pie mt">
        <button class="btn btn--peligro" id="detBorrar">🗑️ Eliminar</button>
        <button class="btn btn--primario" id="detEditar">✏️ Editar</button>
      </div>`;

    UI.abrirModal(esBloqueo ? '🔒 Bloqueo' : (esAirbnb ? '🩷 Reserva Airbnb' : (r.cliente || 'Reserva')), `
      <div style="margin-bottom:12px"><span class="insignia" style="background:${ori.color};color:#fff">${ori.emoji} ${ori.etiqueta}</span></div>
      ${f('Alojamiento', unidad ? U.escapar(unidad.nombre) : '—')}
      ${unidad && unidad.componentes && unidad.componentes.length ? f('Bloquea', unidad.componentes.map((c) => { const x = S.unidadPorId(c); return x ? U.escapar(x.nombre) : c; }).join(', ')) : ''}
      ${f('Entrada', U.formatoLargo(r.entrada))}
      ${f('Salida', U.formatoLargo(r.salida))}
      ${f('Noches', U.noches(r.entrada, r.salida))}
      ${!esBloqueo && !esAirbnb ? f('Personas', r.personas || 1) : ''}
      ${!esBloqueo && !esAirbnb && r.telefono ? f('Teléfono', `<a href="tel:${U.escapar(r.telefono)}">${U.escapar(r.telefono)}</a>`) : ''}
      ${!esBloqueo && !esAirbnb ? f('Precio', U.formatoDinero(r.precioTotal, S.moneda())) : ''}
      ${!esBloqueo && !esAirbnb ? f('Pagado', `${U.formatoDinero(r.pagado, S.moneda())} · ${S.estadoPago(r.estadoPago).etiqueta}`) : ''}
      ${!esBloqueo && !esAirbnb && M.saldo(r) > 0 ? f('Saldo', `<span style="color:var(--color-error)">${U.formatoDinero(M.saldo(r), S.moneda())}</span>`) : ''}
      ${r.observaciones ? `<div class="mt"><strong>Observaciones:</strong><br>${U.escapar(r.observaciones)}</div>` : ''}
      ${pie}
    `);
    if (!esAirbnb) {
      document.getElementById('detEditar').onclick = () => abrirFormulario(id);
      document.getElementById('detBorrar').onclick = async () => {
        if (await UI.confirmar('¿Eliminar?')) { S.eliminarReserva(id); UI.toast('Eliminada', 'exito'); UI.cerrarModal(); window.AgendaApp.repintar(); }
      };
    }
  }

  // ---------------------------------------------------------
  // Formulario de alta / edición
  // ---------------------------------------------------------
  function abrirFormulario(id, datosIniciales) {
    if (!S.unidades().length) {
      UI.toast('Primero crea una unidad', 'aviso');
      window.AgendaApp.irA('alojamientos');
      return;
    }
    const r = id ? S.reservaPorId(id) : null;
    if (r && r.importadaAirbnb) { verDetalle(id); return; } // solo lectura
    const hoy = U.hoyISO();
    const val = {
      unidadId: (r && r.unidadId) || (datosIniciales && datosIniciales.unidadId) || S.unidades()[0].id,
      cliente: (r && r.cliente) || '',
      telefono: (r && r.telefono) || '',
      entrada: (r && r.entrada) || (datosIniciales && datosIniciales.entrada) || hoy,
      salida: (r && r.salida) || (datosIniciales && (datosIniciales.salida || U.sumarDias(datosIniciales.entrada, 1))) || U.sumarDias(hoy, 1),
      personas: (r && r.personas) || 2,
      origen: (r && r.origen) || 'directa',
      estadoPago: (r && r.estadoPago) || 'pendiente',
      precioTotal: (r && r.precioTotal) != null ? r.precioTotal : '',
      pagado: (r && r.pagado) != null ? r.pagado : 0,
      observaciones: (r && r.observaciones) || '',
    };

    UI.abrirModal(id ? 'Editar reserva' : 'Nueva reserva', `
      <form id="formReserva" autocomplete="off">
        <div id="avisoConflicto"></div>

        <div class="campo">
          <label>Alojamiento *</label>
          <select name="unidadId" required>
            ${S.unidades().map((u) => `<option value="${u.id}" ${val.unidadId === u.id ? 'selected' : ''}>${U.escapar(u.nombre)}${u.componentes && u.componentes.length ? ' 🏠 (bloquea las habitaciones)' : ''}</option>`).join('')}
          </select>
          <span class="campo__ayuda" id="ayudaEspacios"></span>
        </div>

        <div class="campos-2">
          <div class="campo">
            <label>Entrada *</label>
            <input name="entrada" type="date" required value="${val.entrada}" />
          </div>
          <div class="campo">
            <label>Salida *</label>
            <input name="salida" type="date" required value="${val.salida}" />
          </div>
        </div>

        <div class="campo">
          <label>Origen / color *</label>
          <div class="selector-origen" id="selectorOrigen">
            ${S.ORIGENES.map((o) => `
              <label class="origen-opcion ${val.origen === o.id ? 'is-active' : ''}" style="--c:${o.color}">
                <input type="radio" name="origen" value="${o.id}" ${val.origen === o.id ? 'checked' : ''} hidden />
                <span class="origen-punto" style="background:${o.color}"></span>${o.emoji} ${o.etiqueta}
              </label>`).join('')}
          </div>
        </div>

        <div id="camposReserva">
          <div class="campo">
            <label>Cliente *</label>
            <input name="cliente" list="listaClientes" value="${U.escapar(val.cliente)}" placeholder="Nombre del cliente" />
            <datalist id="listaClientes">${S.clientes().map((c) => `<option value="${U.escapar(c.nombre)}">`).join('')}</datalist>
          </div>
          <div class="campos-2">
            <div class="campo">
              <label>Teléfono</label>
              <input name="telefono" value="${U.escapar(val.telefono)}" placeholder="+34 …" />
            </div>
            <div class="campo">
              <label>Personas</label>
              <input name="personas" type="number" min="1" value="${val.personas}" />
            </div>
          </div>
          <div class="campos-2">
            <div class="campo">
              <label>Precio total (${S.moneda()})</label>
              <input name="precioTotal" type="number" min="0" step="0.01" value="${val.precioTotal}" placeholder="0" />
              <span class="campo__ayuda" id="ayudaPrecio"></span>
            </div>
            <div class="campo">
              <label>Estado de pago</label>
              <select name="estadoPago">
                ${S.ESTADOS_PAGO.map((e) => `<option value="${e.id}" ${val.estadoPago === e.id ? 'selected' : ''}>${e.etiqueta}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="campo">
            <label>Pagado / anticipo (${S.moneda()})</label>
            <input name="pagado" type="number" min="0" step="0.01" value="${val.pagado}" />
          </div>
        </div>

        <div class="campo">
          <label id="labelObs">Observaciones</label>
          <textarea name="observaciones" placeholder="Hora de llegada, peticiones…">${U.escapar(val.observaciones)}</textarea>
        </div>

        <div class="modal__pie">
          <button type="button" class="btn" id="formCancelar">Cancelar</button>
          <button type="submit" class="btn btn--primario btn--grande" id="btnGuardar">${id ? 'Guardar' : 'Crear reserva'}</button>
        </div>
      </form>
    `);

    const form = document.getElementById('formReserva');
    const { unidadId: campoUnidad, entrada: campoEntrada, salida: campoSalida, precioTotal: campoPrecio } = form;

    // Feedback visual del selector de origen + campos que se ocultan si es bloqueo.
    document.getElementById('selectorOrigen').addEventListener('click', (e) => {
      const opcion = e.target.closest('.origen-opcion');
      if (!opcion) return;
      document.querySelectorAll('.origen-opcion').forEach((o) => o.classList.remove('is-active'));
      opcion.classList.add('is-active');
      setTimeout(aplicarTipo, 0);
    });

    function esBloqueo() { return form.origen.value === 'bloqueo'; }

    function aplicarTipo() {
      const bloqueo = esBloqueo();
      document.getElementById('camposReserva').style.display = bloqueo ? 'none' : '';
      document.getElementById('labelObs').textContent = bloqueo ? 'Motivo del bloqueo' : 'Observaciones';
      revisar();
    }

    // Núcleo de la validación: detectar solapes y BLOQUEAR el guardado.
    function revisar() {
      const avisoEl = document.getElementById('avisoConflicto');
      const btnGuardar = document.getElementById('btnGuardar');
      const entrada = campoEntrada.value;
      const salida = campoSalida.value;
      const unidad = S.unidadPorId(campoUnidad.value);

      // Mostrar qué espacios ocupa (didáctico para la función estrella).
      const ayudaEsp = document.getElementById('ayudaEspacios');
      if (unidad && unidad.componentes && unidad.componentes.length) {
        ayudaEsp.textContent = `Reservar esto ocupa y bloquea: ${unidad.componentes.map((c) => (S.unidadPorId(c) || {}).nombre).filter(Boolean).join(', ')}.`;
      } else {
        const casas = S.unidades().filter((u) => (u.componentes || []).includes(campoUnidad.value));
        ayudaEsp.textContent = casas.length ? `Parte de: ${casas.map((c) => c.nombre).join(', ')}.` : '';
      }

      const ayudaPrecio = document.getElementById('ayudaPrecio');
      const n = entrada && salida ? U.noches(entrada, salida) : 0;
      if (ayudaPrecio) {
        ayudaPrecio.textContent = (n > 0 && unidad && unidad.precioBase)
          ? `Sugerido: ${U.formatoDinero(unidad.precioBase * n, S.moneda())} (${n}×${U.formatoDinero(unidad.precioBase, S.moneda())})` : '';
      }

      let mensaje = '';
      let bloquear = false;
      if (entrada && salida && salida <= entrada) {
        mensaje = '⚠️ La salida debe ser posterior a la entrada.';
        bloquear = true;
      } else if (n > 0) {
        const choques = M.conflictos(campoUnidad.value, entrada, salida, id);
        if (choques.length) {
          bloquear = true;
          mensaje = `🚫 <strong>No se puede guardar: fechas ocupadas.</strong> Choca con: ${choques.map((c) => {
            const u = S.unidadPorId(c.unidadId);
            const quien = c.origen === 'bloqueo' ? '🔒 Bloqueo' : U.escapar(c.cliente);
            return `${quien} en <em>${u ? U.escapar(u.nombre) : '—'}</em> (${U.formatoCorto(c.entrada)}–${U.formatoCorto(c.salida)})`;
          }).join('; ')}.`;
        }
      }

      avisoEl.innerHTML = mensaje ? `<div class="aviso-conflicto">${mensaje}</div>` : '';
      btnGuardar.disabled = bloquear;
      btnGuardar.style.opacity = bloquear ? '.5' : '';
      btnGuardar.style.cursor = bloquear ? 'not-allowed' : '';
    }

    function autoPrecio() {
      if (esBloqueo()) return;
      if (campoPrecio.value === '' || campoPrecio.value === '0') {
        const n = U.noches(campoEntrada.value, campoSalida.value);
        const unidad = S.unidadPorId(campoUnidad.value);
        if (n > 0 && unidad && unidad.precioBase) campoPrecio.value = unidad.precioBase * n;
      }
    }

    [campoEntrada, campoSalida, campoUnidad].forEach((c) => c.addEventListener('change', revisar));
    campoUnidad.addEventListener('change', autoPrecio);
    campoSalida.addEventListener('change', autoPrecio);
    aplicarTipo();

    document.getElementById('formCancelar').onclick = UI.cerrarModal;

    form.onsubmit = (e) => {
      e.preventDefault();
      const bloqueo = esBloqueo();
      const datos = {
        unidadId: campoUnidad.value,
        entrada: campoEntrada.value,
        salida: campoSalida.value,
        origen: form.origen.value,
        observaciones: form.observaciones.value.trim(),
        cliente: bloqueo ? '' : form.cliente.value.trim(),
        telefono: bloqueo ? '' : form.telefono.value.trim(),
        personas: bloqueo ? 0 : (Number(form.personas.value) || 1),
        precioTotal: bloqueo ? 0 : (Number(form.precioTotal.value) || 0),
        pagado: bloqueo ? 0 : (Number(form.pagado.value) || 0),
        estadoPago: bloqueo ? 'pagado' : form.estadoPago.value,
      };

      // Validaciones que impiden guardar.
      if (datos.salida <= datos.entrada) { UI.toast('La salida debe ser posterior a la entrada', 'error'); return; }
      if (!bloqueo && !datos.cliente) { UI.toast('Falta el nombre del cliente', 'error'); return; }
      const choques = M.conflictos(datos.unidadId, datos.entrada, datos.salida, id);
      if (choques.length) {
        UI.toast('No se puede guardar: esas fechas ya están ocupadas', 'error');
        revisar();
        return;
      }

      if (id) datos.id = id;
      S.guardarReserva(datos);
      UI.toast(id ? 'Reserva actualizada' : (bloqueo ? 'Bloqueo creado' : 'Reserva creada'), 'exito');
      UI.cerrarModal();
      window.AgendaApp.repintar();
    };
  }

  // ---------------------------------------------------------
  // Exportar CSV
  // ---------------------------------------------------------
  function exportarCSV() {
    const cols = ['Cliente', 'Alojamiento', 'Origen', 'Entrada', 'Salida', 'Noches', 'Personas', 'Precio', 'Pagado', 'Estado pago', 'Teléfono', 'Observaciones'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const filas = reservasFiltradas().map((r) => {
      const u = S.unidadPorId(r.unidadId);
      return [
        r.origen === 'bloqueo' ? 'BLOQUEO' : r.cliente, u ? u.nombre : '', S.origen(r.origen).etiqueta,
        r.entrada, r.salida, U.noches(r.entrada, r.salida), r.personas,
        r.precioTotal, r.pagado, S.estadoPago(r.estadoPago).etiqueta, r.telefono, r.observaciones,
      ].map(esc).join(',');
    });
    U.descargarArchivo(`reservas-${U.hoyISO()}.csv`, '﻿' + [cols.map(esc).join(','), ...filas].join('\r\n'), 'text/csv;charset=utf-8');
    UI.toast('CSV exportado', 'exito');
  }

  window.AgendaReservas = { render, abrirFormulario, verDetalle };
})();
