/* ============================================================
   estadisticas.js — AT El Sotillo Manager · estadísticas del año.
   KPIs + gráficos de barras (CSS, sin librerías): ocupación e
   ingresos por mes, ingresos por origen y por unidad.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;

  const hoy = U.desdeISO(U.hoyISO());
  const vista = { anio: hoy.getFullYear() };

  const MESES_CORTOS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  function render(contenedor) {
    const e = M.estadisticasAnio(vista.anio);
    const moneda = S.moneda();

    contenedor.innerHTML = `
      <div class="fila fila--between">
        <h2>Estadísticas</h2>
        <div class="cal-controles" style="margin:0">
          <button class="btn btn--sm" id="estPrev">‹</button>
          <span class="cal-mes-titulo" style="min-width:80px;text-align:center">${e.anio}</span>
          <button class="btn btn--sm" id="estNext">›</button>
        </div>
      </div>

      <div class="kpis mt">
        ${kpi('Ingresos del año', U.formatoDinero(e.totalIngresos, moneda), '', true)}
        ${kpi('Ocupación media', `${e.ocupacionMediaPct}%`, barra(e.ocupacionMediaPct))}
        ${kpi('Reservas', e.nReservas, `${e.totalNoches} noches vendidas`)}
        ${kpi('Estancia media', `${e.estanciaMedia.toFixed(1)} noches`, `Precio medio ${U.formatoDinero(e.adr, moneda)}/noche`)}
      </div>

      <div class="panel-cols">
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">Ocupación por mes (%)</h3>
          ${barrasVerticales(e.meses.map((m) => m.ocupacionPct), '%', 100)}
        </div>
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">Ingresos por mes (${moneda})</h3>
          ${barrasVerticales(e.meses.map((m) => m.ingresosMes), moneda, null)}
        </div>
      </div>

      <div class="panel-cols">
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">Ingresos por origen</h3>
          ${barrasOrigen(e.ingresosPorOrigen, e.totalIngresos, moneda)}
        </div>
        <div class="tarjeta">
          <h3 class="tarjeta__titulo">Ingresos y ocupación por unidad</h3>
          ${barrasUnidad(e, moneda)}
        </div>
      </div>
    `;

    document.getElementById('estPrev').onclick = () => { vista.anio--; render(contenedor); };
    document.getElementById('estNext').onclick = () => { vista.anio++; render(contenedor); };
  }

  function kpi(etiqueta, valor, extra, marca) {
    return `<div class="kpi ${marca ? 'kpi--marca' : ''}">
      <div class="kpi__valor">${valor}</div><div class="kpi__etiqueta">${etiqueta}</div>${extra || ''}</div>`;
  }
  function barra(pct) {
    return `<div class="barra-ocupacion"><div class="barra-ocupacion__relleno" style="width:${Math.min(100, pct)}%"></div></div>`;
  }

  // Gráfico de barras verticales (12 meses). maxFijo opcional (p.ej. 100 para %).
  function barrasVerticales(valores, sufijo, maxFijo) {
    const max = maxFijo != null ? maxFijo : Math.max(1, ...valores);
    const mesActual = (vista.anio === hoy.getFullYear()) ? hoy.getMonth() : -1;
    return `<div class="grafico-v">
      ${valores.map((v, i) => {
        const alto = max ? Math.round((v / max) * 100) : 0;
        const etiquetaV = sufijo === '%' ? `${v}%` : (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v);
        return `<div class="grafico-v__col" title="${U.MESES[i]}: ${v}${sufijo === '%' ? '%' : ' ' + sufijo}">
          <div class="grafico-v__valor">${v ? etiquetaV : ''}</div>
          <div class="grafico-v__barra ${i === mesActual ? 'is-actual' : ''}" style="height:${Math.max(2, alto)}%"></div>
          <div class="grafico-v__eje">${MESES_CORTOS[i]}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function barrasOrigen(ingresosPorOrigen, total, moneda) {
    const filas = S.ORIGENES.filter((o) => o.id !== 'bloqueo').map((o) => ({
      etiqueta: `${o.emoji} ${o.etiqueta}`, color: o.color, valor: ingresosPorOrigen[o.id] || 0,
    }));
    if (!total) return `<p class="tenue">Sin ingresos este año.</p>`;
    return barrasHorizontales(filas, total, moneda);
  }

  function barrasUnidad(e, moneda) {
    const filas = S.unidades().map((u) => ({
      etiqueta: u.nombre,
      color: (u.componentes && u.componentes.length) ? '#334155' : 'var(--color-marca)',
      valor: Math.round(e.ingresosPorUnidad[u.id] || 0),
      sub: `${e.nochesPorUnidad[u.id] || 0} noches · ${Math.round(((e.nochesPorUnidad[u.id] || 0) / e.diasEnAnio) * 100)}% ocup.`,
    })).sort((a, b) => b.valor - a.valor);
    const max = Math.max(1, ...filas.map((f) => f.valor));
    if (!filas.some((f) => f.valor)) return `<p class="tenue">Sin ingresos este año.</p>`;
    return barrasHorizontales(filas, max, moneda, true);
  }

  // Barras horizontales. `porcentajeSobreTotal`: si true muestra % del total.
  function barrasHorizontales(filas, referencia, moneda, mostrarSub) {
    return `<div class="grafico-h">
      ${filas.map((f) => {
        const ancho = referencia ? Math.round((f.valor / referencia) * 100) : 0;
        const pct = !mostrarSub && referencia ? ` · ${Math.round((f.valor / referencia) * 100)}%` : '';
        return `<div class="grafico-h__fila">
          <div class="grafico-h__etiqueta">${U.escapar(f.etiqueta)}</div>
          <div class="grafico-h__pista">
            <div class="grafico-h__barra" style="width:${Math.max(1, ancho)}%;background:${f.color}"></div>
          </div>
          <div class="grafico-h__valor">${U.formatoDinero(f.valor, moneda)}${pct}${f.sub ? `<span class="tenue" style="display:block;font-size:11px;font-weight:400">${f.sub}</span>` : ''}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  window.AgendaEstadisticas = { render };
})();
