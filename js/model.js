/* ============================================================
   model.js — AT El Sotillo Manager · lógica de negocio.

   ★ FUNCIÓN ESTRELLA ★
   Reservar "El Sotillo 2" (casa completa) debe bloquear las
   Habitaciones 1..5, y si cualquiera de esas habitaciones está
   ocupada, NO se puede reservar la casa completa.

   Se resuelve con "espacios físicos": cada unidad ocupa un conjunto
   de espacios = { ella misma } ∪ { sus componentes }. Dos reservas
   chocan si sus conjuntos de espacios se intersecan y sus fechas se
   solapan. Así:
     - El Sotillo 2 → {sotillo2, hab1..hab5}
     - Habitación 3 → {hab3}
     → intersección {hab3} ≠ ∅  → conflicto ✔
     - Habitación 1 → {hab1}; Habitación 2 → {hab2}
     → sin intersección → NO chocan (son independientes entre sí) ✔
   ============================================================ */
(function () {
  'use strict';

  const U = window.AgendaUtil;
  const S = window.AgendaStore;

  // Conjunto de espacios físicos que ocupa una unidad (ella + componentes).
  function espaciosDeUnidad(unidadId) {
    const unidad = S.unidadPorId(unidadId);
    if (!unidad) return new Set([unidadId]);
    return new Set([unidad.id, ...(unidad.componentes || [])]);
  }

  function espaciosSeIntersecan(unidadIdA, unidadIdB) {
    const a = espaciosDeUnidad(unidadIdA);
    for (const espacio of espaciosDeUnidad(unidadIdB)) {
      if (a.has(espacio)) return true;
    }
    return false;
  }

  // Un bloqueo o reserva "cancelada" (si existiera) no cuenta como choque de pago,
  // pero un bloqueo SÍ ocupa el espacio. Sólo se ignora lo explícitamente anulado.
  function esActiva(reserva) {
    return reserva.estado !== 'cancelada';
  }

  // Dos rangos [entrada, salida) chocan si comparten al menos una noche.
  // El día de salida es check-out: ese día la unidad queda libre, por eso
  // salida == entrada de otra reserva NO es conflicto.
  function fechasSeSolapan(entradaA, salidaA, entradaB, salidaB) {
    return entradaA < salidaB && entradaB < salidaA;
  }

  // Reservas que impiden reservar `unidadId` en [entrada, salida),
  // teniendo en cuenta el bloqueo compuesto. `excluirId` = la que editamos.
  function conflictos(unidadId, entrada, salida, excluirId) {
    return S.reservas().filter((r) =>
      r.id !== excluirId &&
      esActiva(r) &&
      espaciosSeIntersecan(unidadId, r.unidadId) &&
      fechasSeSolapan(entrada, salida, r.entrada, r.salida));
  }

  // ¿Hay algo ocupando el espacio de `unidadId` la noche que empieza en diaISO?
  function reservaEnNoche(unidadId, diaISO) {
    return S.reservas().find((r) =>
      esActiva(r) &&
      espaciosSeIntersecan(unidadId, r.unidadId) &&
      r.entrada <= diaISO && diaISO < r.salida) || null;
  }

  // Reserva "propia" de la unidad esa noche (para dibujar la barra en su fila).
  function reservaPropiaEnNoche(unidadId, diaISO) {
    return S.reservas().find((r) =>
      r.unidadId === unidadId && esActiva(r) &&
      r.entrada <= diaISO && diaISO < r.salida) || null;
  }

  function saldo(reserva) {
    return (Number(reserva.precioTotal) || 0) - (Number(reserva.pagado) || 0);
  }

  function precioPorNoche(reserva) {
    const n = U.noches(reserva.entrada, reserva.salida);
    return n > 0 ? (Number(reserva.precioTotal) || 0) / n : 0;
  }

  function nochesEnRango(reserva, desde, hasta) {
    const ini = reserva.entrada > desde ? reserva.entrada : desde;
    const fin = reserva.salida < hasta ? reserva.salida : hasta;
    const n = U.noches(ini, fin);
    return n > 0 ? n : 0;
  }

  // ---- Métricas de un mes ----------------------------------------------
  function metricasMes(anio, mesIndice) {
    const diasEnMes = new Date(anio, mesIndice + 1, 0).getDate();
    const inicioMes = U.aISO(new Date(anio, mesIndice, 1, 12));
    const finMes = U.aISO(new Date(anio, mesIndice, diasEnMes, 12));
    // Unidades "reservables de verdad": la casa completa comparte espacios
    // con sus habitaciones, así que para ocupación contamos los espacios
    // físicos base (no la casa completa, para no contar doble).
    const espaciosBase = S.unidades().filter((u) => !(u.componentes && u.componentes.length));
    const nochesDisponibles = espaciosBase.length * diasEnMes;
    let nochesOcupadas = 0;
    let ingresosMes = 0;
    let llegadas = 0;

    for (let d = 0; d < diasEnMes; d++) {
      const dia = U.sumarDias(inicioMes, d);
      espaciosBase.forEach((u) => { if (reservaEnNoche(u.id, dia)) nochesOcupadas++; });
    }

    S.reservas().forEach((r) => {
      if (!esActiva(r) || r.origen === 'bloqueo') return;
      if (r.entrada >= inicioMes && r.entrada <= finMes) llegadas++;
      const nd = nochesEnRango(r, inicioMes, U.sumarDias(finMes, 1));
      if (nd > 0) ingresosMes += precioPorNoche(r) * nd;
    });

    return {
      diasEnMes, nochesDisponibles, nochesOcupadas,
      ocupacionPct: nochesDisponibles ? Math.round((nochesOcupadas / nochesDisponibles) * 100) : 0,
      ingresosMes: Math.round(ingresosMes), llegadas,
    };
  }

  function metricasGlobales() {
    const hoy = U.hoyISO();
    const activas = S.reservas().filter((r) => esActiva(r) && r.origen !== 'bloqueo');

    const alojadosAhora = activas.filter((r) => r.entrada <= hoy && hoy < r.salida);
    const proximas = activas.filter((r) => r.entrada >= hoy).sort((a, b) => a.entrada.localeCompare(b.entrada));

    let saldoPendienteTotal = 0;
    activas.forEach((r) => { saldoPendienteTotal += Math.max(0, saldo(r)); });

    const ahora = U.desdeISO(hoy);
    const met = metricasMes(ahora.getFullYear(), ahora.getMonth());

    return {
      totalUnidades: S.unidades().length,
      totalReservas: activas.length,
      alojadosAhora, proximas,
      saldoPendienteTotal: Math.round(saldoPendienteTotal),
      ocupacionMesPct: met.ocupacionPct,
      ingresosMes: met.ingresosMes,
      llegadasHoy: activas.filter((r) => r.entrada === hoy),
      salidasHoy: activas.filter((r) => r.salida === hoy),
    };
  }

  function reservasDeCliente(nombre) {
    const clave = (nombre || '').trim().toLowerCase();
    return S.reservas()
      .filter((r) => (r.cliente || '').trim().toLowerCase() === clave)
      .sort((a, b) => b.entrada.localeCompare(a.entrada));
  }

  // ---- Limpieza -------------------------------------------------------
  // Próxima reserva que ocupará el espacio de la unidad a partir de `desdeISO`
  // (para saber si una limpieza es urgente: entra alguien pronto / el mismo día).
  function proximaLlegada(unidadId, desdeISO) {
    return S.reservas()
      .filter((r) => esActiva(r) && r.origen !== 'bloqueo' &&
        espaciosSeIntersecan(unidadId, r.unidadId) && r.entrada >= desdeISO)
      .sort((a, b) => a.entrada.localeCompare(b.entrada))[0] || null;
  }

  // Salidas ya ocurridas (salida <= hoy) sin limpieza hecha → hay que limpiar.
  function pendientesLimpieza() {
    const hoy = U.hoyISO();
    return S.reservas()
      .filter((r) => r.origen !== 'bloqueo' && esActiva(r) && !r.limpiezaHecha && r.salida <= hoy)
      .map((r) => ({ reserva: r, proxima: proximaLlegada(r.unidadId, r.salida) }))
      .sort((a, b) => a.reserva.salida.localeCompare(b.reserva.salida));
  }

  // Salidas próximas (dentro de `dias`) para preparar limpiezas por adelantado.
  function proximasSalidas(dias) {
    const hoy = U.hoyISO();
    const limite = U.sumarDias(hoy, dias);
    return S.reservas()
      .filter((r) => r.origen !== 'bloqueo' && esActiva(r) && !r.limpiezaHecha && r.salida > hoy && r.salida <= limite)
      .map((r) => ({ reserva: r, proxima: proximaLlegada(r.unidadId, r.salida) }))
      .sort((a, b) => a.reserva.salida.localeCompare(b.reserva.salida));
  }

  // ---- Estadísticas del año ------------------------------------------
  function estadisticasAnio(anio) {
    const inicioAnio = `${anio}-01-01`;
    const finAnioExcl = `${anio + 1}-01-01`;
    const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
    const diasEnAnio = bisiesto ? 366 : 365;

    const meses = [];
    let nochesOcupadasAnio = 0;
    let nochesDisponiblesAnio = 0;
    for (let m = 0; m < 12; m++) {
      const met = metricasMes(anio, m);
      meses.push(met);
      nochesOcupadasAnio += met.nochesOcupadas;
      nochesDisponiblesAnio += met.nochesDisponibles;
    }

    const reservasAnio = S.reservas().filter((r) =>
      r.origen !== 'bloqueo' && esActiva(r) && r.entrada < finAnioExcl && r.salida > inicioAnio);

    let totalIngresos = 0;
    let totalNoches = 0;
    const ingresosPorOrigen = {};
    const ingresosPorUnidad = {};
    const nochesPorUnidad = {};
    reservasAnio.forEach((r) => {
      const nd = nochesEnRango(r, inicioAnio, finAnioExcl);
      const ingr = precioPorNoche(r) * nd;
      totalIngresos += ingr;
      totalNoches += nd;
      ingresosPorOrigen[r.origen] = (ingresosPorOrigen[r.origen] || 0) + ingr;
      ingresosPorUnidad[r.unidadId] = (ingresosPorUnidad[r.unidadId] || 0) + ingr;
      nochesPorUnidad[r.unidadId] = (nochesPorUnidad[r.unidadId] || 0) + nd;
    });

    // Reservas que EMPIEZAN en el año (para nº y estancia media).
    const iniciadas = S.reservas().filter((r) =>
      r.origen !== 'bloqueo' && esActiva(r) && r.entrada >= inicioAnio && r.entrada < finAnioExcl);
    const nReservas = iniciadas.length;
    const nochesIniciadas = iniciadas.reduce((s, r) => s + U.noches(r.entrada, r.salida), 0);

    return {
      anio, meses, diasEnAnio,
      totalIngresos: Math.round(totalIngresos),
      totalNoches,
      ocupacionMediaPct: nochesDisponiblesAnio ? Math.round((nochesOcupadasAnio / nochesDisponiblesAnio) * 100) : 0,
      nReservas,
      estanciaMedia: nReservas ? (nochesIniciadas / nReservas) : 0,
      adr: totalNoches ? (totalIngresos / totalNoches) : 0, // precio medio por noche vendida
      ingresosPorOrigen, ingresosPorUnidad, nochesPorUnidad,
    };
  }

  window.AgendaModel = {
    espaciosDeUnidad, espaciosSeIntersecan, esActiva, fechasSeSolapan,
    conflictos, reservaEnNoche, reservaPropiaEnNoche,
    saldo, precioPorNoche, nochesEnRango, metricasMes, metricasGlobales, reservasDeCliente,
    proximaLlegada, pendientesLimpieza, proximasSalidas, estadisticasAnio,
  };
})();
