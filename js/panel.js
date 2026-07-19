/* ============================================================
   panel.js — AT El Sotillo Manager · Inicio (panel).
   KPIs, ocupación del mes, próximas llegadas y cobros pendientes.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;

  function render(contenedor) {
    const m = M.metricasGlobales();

    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Inicio</h2>
        <button class="btn btn--primario btn--grande" id="panelNueva">➕ Nueva reserva</button>
      </div>

      <div class="kpis mt">
        ${kpi('Ocupación del mes', `${m.ocupacionMesPct}%`, barra(m.ocupacionMesPct), true)}
        ${kpi('Ingresos del mes', U.formatoDinero(m.ingresosMes, S.moneda()), '<span class="kpi__pie">prorrateado por noches</span>')}
        ${kpi('Alojados ahora', m.alojadosAhora.length, `<span class="kpi__pie">${m.totalUnidades} unidades</span>`)}
        ${kpi('Por cobrar', U.formatoDinero(m.saldoPendienteTotal, S.moneda()), '<span class="kpi__pie">saldos pendientes</span>')}
      </div>

      ${(m.llegadasHoy.length || m.salidasHoy.length) ? `<div class="kpis mt">
        ${m.llegadasHoy.length ? kpi('Entradas hoy 🛬', m.llegadasHoy.length, mini(m.llegadasHoy)) : ''}
        ${m.salidasHoy.length ? kpi('Salidas hoy 🛫', m.salidasHoy.length, mini(m.salidasHoy)) : ''}
      </div>` : ''}

      <div class="panel-cols">
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">🛬 Próximas entradas</h3>
          ${eventos(m.proximas.slice(0, 6))}
        </div>
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">💰 Cobros pendientes</h3>
          ${cobros()}
        </div>
      </div>
    `;

    document.getElementById('panelNueva').onclick = () => window.AgendaReservas.abrirFormulario(null);
    contenedor.querySelectorAll('[data-reserva]').forEach((el) => {
      el.style.cursor = 'pointer';
      el.onclick = () => window.AgendaReservas.verDetalle(el.dataset.reserva);
    });
  }

  function kpi(etiqueta, valor, extra, marca) {
    return `<div class="kpi ${marca ? 'kpi--marca' : ''}">
      <div class="kpi__valor">${valor}</div><div class="kpi__etiqueta">${etiqueta}</div>${extra || ''}</div>`;
  }
  function barra(pct) {
    return `<div class="barra-ocupacion"><div class="barra-ocupacion__relleno" style="width:${Math.min(100, pct)}%"></div></div>`;
  }
  function mini(reservas) { return `<div class="kpi__pie">${reservas.map((r) => U.escapar(r.cliente)).join(', ')}</div>`; }

  function eventos(reservas) {
    if (!reservas.length) return vacio('🗓️', 'Sin próximas entradas.');
    return `<div class="lista-eventos">${reservas.map((r) => {
      const fecha = U.desdeISO(r.entrada);
      const u = S.unidadPorId(r.unidadId);
      const ori = S.origen(r.origen);
      return `<div class="evento" data-reserva="${r.id}">
        <div class="evento__dia">
          <div class="evento__dia-num">${fecha.getDate()}</div>
          <div class="evento__dia-mes">${U.MESES[fecha.getMonth()].slice(0, 3)}</div>
        </div>
        <div class="evento__cuerpo">
          <div class="evento__nombre">${U.escapar(r.cliente)}</div>
          <div class="evento__detalle">${u ? U.escapar(u.nombre) : ''} · ${U.noches(r.entrada, r.salida)} noches · ${r.personas} pers.</div>
        </div>
        <span class="punto" style="background:${ori.color}" title="${ori.etiqueta}"></span>
      </div>`;
    }).join('')}</div>`;
  }

  function cobros() {
    const conSaldo = S.reservas()
      .filter((r) => M.esActiva(r) && r.origen !== 'bloqueo' && M.saldo(r) > 0)
      .sort((a, b) => a.entrada.localeCompare(b.entrada)).slice(0, 6);
    if (!conSaldo.length) return vacio('✅', 'Todo cobrado.');
    return `<div class="lista-eventos">${conSaldo.map((r) => `
      <div class="evento" data-reserva="${r.id}">
        <div class="evento__cuerpo">
          <div class="evento__nombre">${U.escapar(r.cliente)}</div>
          <div class="evento__detalle">Entrada ${U.formatoCorto(r.entrada)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;color:var(--color-error)">${U.formatoDinero(M.saldo(r), S.moneda())}</div>
          <div class="tenue" style="font-size:11px">de ${U.formatoDinero(r.precioTotal, S.moneda())}</div>
        </div>
      </div>`).join('')}</div>`;
  }

  function vacio(icono, texto) {
    return `<div class="vacio" style="padding:24px"><div class="vacio__icono" style="font-size:32px">${icono}</div>${texto}</div>`;
  }

  window.AgendaPanel = { render };
})();
