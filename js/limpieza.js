/* ============================================================
   limpieza.js — AT El Sotillo Manager · gestión de limpieza.
   Tras cada salida, la unidad queda "pendiente de limpieza" hasta
   marcarla como limpia. Señala urgencia si entra otro huésped pronto.
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;
  const M = window.AgendaModel;
  const UI = window.AgendaUI;

  function render(contenedor) {
    const pendientes = M.pendientesLimpieza();
    const proximas = M.proximasSalidas(7);

    contenedor.innerHTML = `
      <h2>Limpieza</h2>
      <p class="suave mt-sm">Cada salida deja la unidad pendiente de limpieza. Márcala como limpia cuando esté lista para el siguiente huésped.</p>

      <div class="kpis mt">
        ${kpi('Pendientes ahora', pendientes.length, pendientes.length ? '🧹 requieren limpieza' : '✨ todo limpio', pendientes.length ? 'aviso' : 'exito')}
        ${kpi('Urgentes hoy', pendientes.filter(esUrgente).length, 'entra huésped hoy/mañana', 'error')}
        ${kpi('Salidas (7 días)', proximas.length, 'para planificar', 'info')}
      </div>

      <h3 class="mt">🧹 Pendientes de limpieza</h3>
      <div id="listaPendientes">${listaPendientes(pendientes)}</div>

      <h3 class="mt">📅 Próximas salidas (7 días)</h3>
      ${listaProximas(proximas)}
    `;

    enlazar(contenedor);
  }

  // Urgente: entra alguien el día de la salida o al día siguiente.
  function esUrgente(item) {
    if (!item.proxima) return false;
    return item.proxima.entrada <= U.sumarDias(item.reserva.salida, 1);
  }

  function kpi(etiqueta, valor, pie, tono) {
    const color = { aviso: 'var(--color-aviso)', error: 'var(--color-error)', exito: 'var(--color-exito)', info: 'var(--color-info)' }[tono] || '';
    return `<div class="kpi">
      <div class="kpi__valor" style="color:${color}">${valor}</div>
      <div class="kpi__etiqueta">${etiqueta}</div>
      <div class="kpi__pie">${pie}</div>
    </div>`;
  }

  function listaPendientes(pendientes) {
    if (!pendientes.length) {
      return `<div class="vacio"><div class="vacio__icono">✨</div>No hay limpiezas pendientes. ¡Todo listo!</div>`;
    }
    return `<div class="lista-eventos mt-sm">${pendientes.map((item) => tarjeta(item, true)).join('')}</div>`;
  }

  function listaProximas(proximas) {
    if (!proximas.length) return `<p class="tenue">Sin salidas en los próximos 7 días.</p>`;
    return `<div class="lista-eventos mt-sm">${proximas.map((item) => tarjeta(item, false)).join('')}</div>`;
  }

  function tarjeta(item, accion) {
    const r = item.reserva;
    const unidad = S.unidadPorId(r.unidadId);
    const urgente = esUrgente(item);
    const proxTxt = item.proxima
      ? `Entra <strong>${U.escapar(item.proxima.cliente)}</strong> el ${U.formatoCorto(item.proxima.entrada)}`
      : 'Sin próxima reserva';
    return `<div class="evento ${urgente ? 'evento--urgente' : ''}">
      <div class="evento__cuerpo">
        <div class="evento__nombre">${U.escapar(unidad ? unidad.nombre : '—')} ${urgente ? '<span class="insignia insignia--cancelada">⚠️ Urgente</span>' : ''}</div>
        <div class="evento__detalle">
          Salió ${U.escapar(r.cliente)} el ${U.formatoLargo(r.salida)} · ${proxTxt}
        </div>
      </div>
      ${accion
        ? `<button class="btn btn--sm btn--primario" data-limpio="${r.id}">✓ Limpio</button>`
        : `<button class="btn btn--sm" data-limpio="${r.id}" title="Marcar como limpia por adelantado">✓ Limpio</button>`}
    </div>`;
  }

  function enlazar(contenedor) {
    contenedor.querySelectorAll('[data-limpio]').forEach((b) => {
      b.onclick = () => {
        S.marcarLimpieza(b.dataset.limpio, true);
        UI.toast('Marcada como limpia ✨', 'exito');
        render(contenedor);
      };
    });
  }

  window.AgendaLimpieza = { render };
})();
