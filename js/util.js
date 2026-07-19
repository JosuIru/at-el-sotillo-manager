/* ============================================================
   util.js — utilidades de fecha, dinero, DOM. Sin dependencias.
   Todo cuelga de window.AgendaUtil para evitar colisiones globales.
   ============================================================ */
(function () {
  'use strict';

  // ---- Fechas: trabajamos con cadenas "YYYY-MM-DD" para evitar
  //      líos de zona horaria (una reserva es un día de calendario, no un instante).
  function hoyISO() {
    const ahora = new Date();
    return aISO(ahora);
  }

  function aISO(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  // Parseamos a mediodía local para que sumar/restar días nunca cruce
  // un cambio de horario de verano por error.
  function desdeISO(cadena) {
    const [anio, mes, dia] = cadena.split('-').map(Number);
    return new Date(anio, mes - 1, dia, 12, 0, 0);
  }

  function sumarDias(cadenaISO, dias) {
    const fecha = desdeISO(cadenaISO);
    fecha.setDate(fecha.getDate() + dias);
    return aISO(fecha);
  }

  // Noches entre entrada y salida (la salida no se cuenta como noche ocupada).
  function noches(entradaISO, salidaISO) {
    const ms = desdeISO(salidaISO) - desdeISO(entradaISO);
    return Math.round(ms / 86400000);
  }

  function diasEntre(desdeISOStr, hastaISOStr) {
    return Math.round((desdeISO(hastaISOStr) - desdeISO(desdeISOStr)) / 86400000);
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  function formatoLargo(cadenaISO) {
    const fecha = desdeISO(cadenaISO);
    return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  function formatoCorto(cadenaISO) {
    const fecha = desdeISO(cadenaISO);
    return `${DIAS_SEM[fecha.getDay()]} ${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }

  function nombreMes(anio, mesIndice) {
    return `${MESES[mesIndice]} ${anio}`;
  }

  function esFinde(cadenaISO) {
    const dia = desdeISO(cadenaISO).getDay();
    return dia === 0 || dia === 6;
  }

  // ---- Dinero
  function formatoDinero(cantidad, moneda) {
    const simbolo = moneda || '€';
    const num = Number(cantidad) || 0;
    return `${num.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${simbolo}`;
  }

  // ---- Identificadores
  function idUnico(prefijo) {
    return `${prefijo || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---- DOM helpers
  function crearNodo(html) {
    const cont = document.createElement('div');
    cont.innerHTML = html.trim();
    return cont.firstElementChild;
  }

  // Escapado para evitar romper el HTML con datos de usuario.
  function escapar(texto) {
    if (texto == null) return '';
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function descargarArchivo(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
  }

  window.AgendaUtil = {
    hoyISO, aISO, desdeISO, sumarDias, noches, diasEntre,
    formatoLargo, formatoCorto, nombreMes, esFinde, MESES, DIAS_SEM,
    formatoDinero, idUnico, crearNodo, escapar, descargarArchivo,
  };
})();
