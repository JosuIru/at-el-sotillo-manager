/* ============================================================
   calendario.js — AT El Sotillo Manager · planning mensual (timeline).

   Fase 1: barras por origen + bloqueo compuesto (función estrella).
   Fase 2:
     · Arrastrar una reserva para MOVERLA (otra unidad y/o fechas,
       conservando las noches).
     · Arrastrar los extremos para REDIMENSIONAR (cambiar entrada/salida).
     · Buscar DISPONIBILIDAD entre dos fechas.
   Todo respeta la función estrella: si el destino solapa, se revierte.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;
  const UI = window.AgendaUI;

  const hoy = U.desdeISO(U.hoyISO());
  const vista = { anio: hoy.getFullYear(), mes: hoy.getMonth() };

  // Contexto geométrico del mes actual (lo usa el arrastre).
  let ctx = null;
  let ignorarClickCelda = false;

  function render(contenedor) {
    if (!S.unidades().length) {
      contenedor.innerHTML = `<h2>Planning</h2>
        <div class="vacio"><div class="vacio__icono">🛏️</div>Aún no hay unidades.
        <br><button class="btn btn--primario mt" id="calIr">Crear unidad</button></div>`;
      document.getElementById('calIr').onclick = () => window.AgendaApp.irA('alojamientos');
      return;
    }

    const met = M.metricasMes(vista.anio, vista.mes);
    const diasEnMes = met.diasEnMes;
    const inicioMes = U.aISO(new Date(vista.anio, vista.mes, 1, 12));
    const hoyISO = U.hoyISO();
    const anchoDia = 38;

    const filaDeUnidad = {};
    S.unidades().forEach((u, i) => { filaDeUnidad[u.id] = i + 2; });
    ctx = { inicioMes, diasEnMes, anchoDia, filaDeUnidad };

    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Planning</h2>
        <div class="fila">
          <button class="btn" id="calDisponibilidad">🔎 Disponibilidad</button>
          <button class="btn btn--primario btn--grande" id="calNueva">➕ Nueva reserva</button>
        </div>
      </div>

      <div class="cal-controles mt">
        <button class="btn" id="calPrev">‹</button>
        <span class="cal-mes-titulo">${U.nombreMes(vista.anio, vista.mes)}</span>
        <button class="btn" id="calNext">›</button>
        <button class="btn btn--sm" id="calHoy">Hoy</button>
        <span class="suave" style="margin-left:auto">Ocupación ${met.ocupacionPct}% · ${met.llegadas} entradas</span>
      </div>

      <div class="timeline-wrap">
        <div class="timeline" id="timelineGrid" style="--num-dias:${diasEnMes};--ancho-dia:${anchoDia}px;--col-unidad:160px">
          ${cabecera(inicioMes, diasEnMes, hoyISO)}
          ${S.unidades().map((u, i) => filaUnidad(u, i, inicioMes, diasEnMes, hoyISO)).join('')}
        </div>
      </div>

      <div class="cal-leyenda">
        ${S.ORIGENES.map((o) => `<span><span class="punto" style="background:${o.color}"></span> ${o.etiqueta}</span>`).join('')}
        <span><span class="punto punto--rayado"></span> Bloqueada por otra unidad</span>
        <span>💡 Arrastra una reserva para moverla · tira de los bordes para cambiar fechas</span>
      </div>
    `;

    document.getElementById('calNueva').onclick = () => window.AgendaReservas.abrirFormulario(null);
    document.getElementById('calDisponibilidad').onclick = abrirDisponibilidad;
    document.getElementById('calPrev').onclick = () => { mover(-1); render(contenedor); };
    document.getElementById('calNext').onclick = () => { mover(1); render(contenedor); };
    document.getElementById('calHoy').onclick = () => { vista.anio = hoy.getFullYear(); vista.mes = hoy.getMonth(); render(contenedor); };

    // Clic en hueco libre → nueva reserva prefijada.
    contenedor.querySelectorAll('.timeline__celda[data-libre]').forEach((celda) => {
      celda.onclick = () => {
        if (ignorarClickCelda) return;
        window.AgendaReservas.abrirFormulario(null, { unidadId: celda.dataset.unidad, entrada: celda.dataset.dia });
      };
    });

    activarArrastre(document.getElementById('timelineGrid'));
  }

  function mover(delta) {
    let m = vista.mes + delta, a = vista.anio;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    vista.mes = m; vista.anio = a;
  }

  function cabecera(inicioMes, diasEnMes, hoyISO) {
    let html = '<div class="timeline__esquina" style="grid-row:1;grid-column:1">Unidad</div>';
    for (let d = 0; d < diasEnMes; d++) {
      const dia = U.sumarDias(inicioMes, d);
      const fecha = U.desdeISO(dia);
      const cls = ['timeline__dia'];
      if (U.esFinde(dia)) cls.push('timeline__dia--finde');
      if (dia === hoyISO) cls.push('timeline__dia--hoy');
      html += `<div class="${cls.join(' ')}" style="grid-row:1;grid-column:${d + 2}"><span class="timeline__dia-sem">${U.DIAS_SEM[fecha.getDay()]}</span>${fecha.getDate()}</div>`;
    }
    return html;
  }

  function filaUnidad(unidad, indice, inicioMes, diasEnMes, hoyISO) {
    const filaGrid = indice + 2;
    let html = `<div class="timeline__unidad" style="grid-row:${filaGrid}">
      <span class="timeline__unidad-color" style="background:${colorUnidad(unidad)}"></span>${U.escapar(unidad.nombre)}
    </div>`;

    for (let d = 0; d < diasEnMes; d++) {
      const dia = U.sumarDias(inicioMes, d);
      const propia = M.reservaPropiaEnNoche(unidad.id, dia);
      const ocupada = propia || M.reservaEnNoche(unidad.id, dia);
      const cls = ['timeline__celda'];
      if (U.esFinde(dia)) cls.push('timeline__celda--finde');
      if (dia === hoyISO) cls.push('timeline__celda--hoy');
      if (!propia && ocupada) cls.push('timeline__celda--bloqueada');
      // Todas las celdas llevan data-unidad/data-dia (las usa el arrastre);
      // sólo las libres son clicables para crear (data-libre).
      const libre = !ocupada ? ' data-libre="1"' : '';
      const titulo = (!propia && ocupada) ? ` title="Bloqueada por ${U.escapar((S.unidadPorId(ocupada.unidadId) || {}).nombre || '')}"` : '';
      html += `<div class="${cls.join(' ')}" style="grid-row:${filaGrid};grid-column:${d + 2}" data-unidad="${unidad.id}" data-dia="${dia}"${libre}${titulo}></div>`;
    }

    const finMesISO = U.sumarDias(inicioMes, diasEnMes);
    S.reservas()
      .filter((r) => r.unidadId === unidad.id && r.salida > inicioMes && r.entrada < finMesISO)
      .forEach((r) => { html += barra(r, filaGrid, inicioMes, diasEnMes); });

    return html;
  }

  function barra(r, filaGrid, inicioMes, diasEnMes) {
    const finMesISO = U.sumarDias(inicioMes, diasEnMes);
    const iniVis = r.entrada < inicioMes ? inicioMes : r.entrada;
    const finVis = r.salida > finMesISO ? finMesISO : r.salida;
    const colInicio = U.diasEntre(inicioMes, iniVis) + 2;
    const nEspan = U.diasEntre(iniVis, finVis);
    if (nEspan <= 0) return '';
    const ori = S.origen(r.origen);
    const esBloqueo = r.origen === 'bloqueo';
    const etiqueta = esBloqueo ? '🔒 ' + (U.escapar(r.observaciones) || 'Bloqueado') : U.escapar(r.cliente);
    const marca = (!esBloqueo && M.saldo(r) > 0) ? ' 💰' : '';
    // Asas de redimensionado sólo si el extremo es visible en el mes.
    const asaIni = r.entrada >= inicioMes ? '<span class="barra-asa barra-asa--ini"></span>' : '';
    const asaFin = r.salida <= finMesISO ? '<span class="barra-asa barra-asa--fin"></span>' : '';
    return `<div class="reserva-barra"
      data-reserva="${r.id}"
      title="${etiqueta} · ${U.formatoCorto(r.entrada)}→${U.formatoCorto(r.salida)} · arrastra para mover"
      style="grid-row:${filaGrid};grid-column:${colInicio} / span ${nEspan};background:${ori.color}">
      ${asaIni}<span class="reserva-barra__txt">${etiqueta}${marca}</span>${asaFin}
    </div>`;
  }

  function colorUnidad(unidad) {
    return (unidad.componentes && unidad.componentes.length) ? '#334155' : '#94a3b8';
  }

  // ---------------------------------------------------------
  // Arrastre: mover y redimensionar reservas
  // ---------------------------------------------------------
  function activarArrastre(grid) {
    let drag = null;

    grid.addEventListener('pointerdown', (e) => {
      const barraEl = e.target.closest('.reserva-barra');
      if (!barraEl) return;
      const reserva = S.reservaPorId(barraEl.dataset.reserva);
      if (!reserva) return;
      const asa = e.target.closest('.barra-asa');
      const modo = asa ? (asa.classList.contains('barra-asa--ini') ? 'ini' : 'fin') : 'mover';
      e.preventDefault();
      drag = {
        reserva, barraEl, modo,
        startX: e.clientX, startY: e.clientY,
        entrada0: reserva.entrada, salida0: reserva.salida, unidad0: reserva.unidadId,
        movido: false, preview: null,
      };
      grid.classList.add('arrastrando');
      grid.setPointerCapture(e.pointerId);
    });

    grid.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.movido && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) drag.movido = true;
      if (!drag.movido) return;

      const pasos = Math.round(dx / ctx.anchoDia);
      let entrada = drag.entrada0, salida = drag.salida0, unidadId = drag.unidad0;

      if (drag.modo === 'mover') {
        entrada = U.sumarDias(drag.entrada0, pasos);
        salida = U.sumarDias(drag.salida0, pasos);
        const celda = celdaBajoCursor(e.clientX, e.clientY);
        if (celda && celda.dataset.unidad) unidadId = celda.dataset.unidad;
      } else if (drag.modo === 'ini') {
        entrada = U.sumarDias(drag.entrada0, pasos);
        if (U.noches(entrada, salida) < 1) entrada = U.sumarDias(salida, -1); // mínimo 1 noche
      } else { // fin
        salida = U.sumarDias(drag.salida0, pasos);
        if (U.noches(entrada, salida) < 1) salida = U.sumarDias(entrada, 1);
      }

      drag.preview = { entrada, salida, unidadId };
      pintarPreview(drag);
    });

    const terminar = (e) => {
      if (!drag) return;
      grid.classList.remove('arrastrando');
      try { grid.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      const d = drag;
      drag = null;

      if (!d.movido) { window.AgendaReservas.verDetalle(d.reserva.id); return; }

      // Evita que el clic de la celda tras soltar dispare "nueva reserva".
      ignorarClickCelda = true;
      setTimeout(() => { ignorarClickCelda = false; }, 50);

      const p = d.preview;
      if (!p) { window.AgendaApp.repintar(); return; }
      if (p.entrada === d.entrada0 && p.salida === d.salida0 && p.unidadId === d.unidad0) {
        window.AgendaApp.repintar(); return;
      }
      if (U.noches(p.entrada, p.salida) < 1) { window.AgendaApp.repintar(); return; }

      const choques = M.conflictos(p.unidadId, p.entrada, p.salida, d.reserva.id);
      if (choques.length) {
        const u = S.unidadPorId(p.unidadId);
        UI.toast(`No cabe en ${u ? u.nombre : 'esa unidad'}: fechas ocupadas`, 'error');
        window.AgendaApp.repintar();
        return;
      }

      S.guardarReserva({ ...d.reserva, id: d.reserva.id, entrada: p.entrada, salida: p.salida, unidadId: p.unidadId });
      const u = S.unidadPorId(p.unidadId);
      UI.toast(`Movida a ${u ? u.nombre : ''} · ${U.formatoCorto(p.entrada)}→${U.formatoCorto(p.salida)}`, 'exito');
      window.AgendaApp.repintar();
    };

    grid.addEventListener('pointerup', terminar);
    grid.addEventListener('pointercancel', terminar);
  }

  // Coloca la barra arrastrada en su posición previa (feedback en vivo).
  function pintarPreview(drag) {
    const { inicioMes, diasEnMes, filaDeUnidad } = ctx;
    const finMesISO = U.sumarDias(inicioMes, diasEnMes);
    const { entrada, salida, unidadId } = drag.preview;
    const iniVis = entrada < inicioMes ? inicioMes : entrada;
    const finVis = salida > finMesISO ? finMesISO : salida;
    const colInicio = U.diasEntre(inicioMes, iniVis) + 2;
    const span = Math.max(1, U.diasEntre(iniVis, finVis));
    const fila = filaDeUnidad[unidadId] || drag.barraEl.style.gridRow;
    drag.barraEl.style.gridRow = fila;
    drag.barraEl.style.gridColumn = `${Math.max(2, colInicio)} / span ${span}`;
    // Rojo si el destino provoca conflicto (aviso visual inmediato).
    const choca = M.conflictos(unidadId, entrada, salida, drag.reserva.id).length > 0;
    drag.barraEl.classList.toggle('reserva-barra--invalida', choca);
  }

  function celdaBajoCursor(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.timeline__celda') : null;
  }

  // ---------------------------------------------------------
  // Buscar disponibilidad entre fechas
  // ---------------------------------------------------------
  function abrirDisponibilidad() {
    const hoyISO = U.hoyISO();
    UI.abrirModal('🔎 Buscar disponibilidad', `
      <form id="formDisp">
        <div class="campos-2">
          <div class="campo"><label>Entrada</label><input name="entrada" type="date" value="${hoyISO}" required /></div>
          <div class="campo"><label>Salida</label><input name="salida" type="date" value="${U.sumarDias(hoyISO, 2)}" required /></div>
        </div>
        <div class="campo"><label>Personas (mínimo)</label><input name="personas" type="number" min="1" value="1" /></div>
        <div class="modal__pie">
          <button type="submit" class="btn btn--primario btn--grande">Buscar</button>
        </div>
      </form>
      <div id="dispResultado"></div>
    `);
    const form = document.getElementById('formDisp');
    const buscar = () => {
      const entrada = form.entrada.value;
      const salida = form.salida.value;
      const personas = Number(form.personas.value) || 1;
      const cont = document.getElementById('dispResultado');
      if (!entrada || !salida || salida <= entrada) {
        cont.innerHTML = `<div class="aviso-conflicto mt">La salida debe ser posterior a la entrada.</div>`;
        return;
      }
      const noches = U.noches(entrada, salida);
      const filas = S.unidades().map((u) => {
        const choques = M.conflictos(u.id, entrada, salida, null);
        const cabe = (u.capacidad || 0) >= personas;
        const libre = choques.length === 0;
        return { u, libre, cabe, choques };
      });
      const libres = filas.filter((f) => f.libre && f.cabe);
      cont.innerHTML = `
        <p class="suave mt">${U.formatoLargo(entrada)} → ${U.formatoLargo(salida)} · ${noches} noche(s) · ${personas} pers.<br>
          <strong>${libres.length}</strong> unidad(es) disponible(s).</p>
        <div class="lista-eventos">
          ${filas.map((f) => {
            const disponible = f.libre && f.cabe;
            const motivo = !f.libre
              ? `Ocupada (${f.choques.map((c) => c.origen === 'bloqueo' ? 'bloqueo' : U.escapar(c.cliente)).join(', ')})`
              : !f.cabe ? `Capacidad ${f.u.capacidad} < ${personas}` : 'Libre';
            return `<div class="evento" style="${disponible ? '' : 'opacity:.6'}">
              <div class="evento__cuerpo">
                <div class="evento__nombre">${disponible ? '✅' : '⛔'} ${U.escapar(f.u.nombre)}</div>
                <div class="evento__detalle">${U.escapar(f.u.tipo || '')} · ${f.u.capacidad || '?'} pers · ${motivo}</div>
              </div>
              ${disponible ? `<button class="btn btn--sm btn--primario" data-reservar="${f.u.id}">Reservar</button>` : ''}
            </div>`;
          }).join('')}
        </div>`;
      cont.querySelectorAll('[data-reservar]').forEach((b) => {
        b.onclick = () => {
          UI.cerrarModal();
          window.AgendaReservas.abrirFormulario(null, { unidadId: b.dataset.reservar, entrada, salida });
        };
      });
    };
    form.onsubmit = (e) => { e.preventDefault(); buscar(); };
    buscar();
  }

  window.AgendaCalendario = { render };
})();
