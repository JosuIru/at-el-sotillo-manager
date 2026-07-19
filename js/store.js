/* ============================================================
   store.js — AT El Sotillo Manager · estado central y persistencia.

   Capa de datos ABSTRACTA: hoy persiste en localStorage; mañana, sin
   tocar las vistas, se puede sustituir el cuerpo de guardar()/cargar()
   por Firebase Firestore (ver README, "Migración a la nube").

   Modelo:
     estado.config      → nombre del negocio, moneda...
     estado.unidades    → alojamientos. Una "Casa completa" puede tener
                          `componentes` (ids de las habitaciones que
                          ocupa por dentro). De ahí sale la FUNCIÓN ESTRELLA.
     estado.reservas    → reservas y bloqueos
     estado.clientes    → directorio de clientes
   ============================================================ */
(function () {
  'use strict';

  const CLAVE = 'atelsotillo_v1';
  const U = window.AgendaUtil;

  // Origen de la reserva → color en el planning (esquema pedido por el cliente).
  const ORIGENES = [
    { id: 'directa', etiqueta: 'Directa', color: '#22c55e', emoji: '🟩' },
    { id: 'airbnb', etiqueta: 'Airbnb', color: '#ff385c', emoji: '🩷' },
    { id: 'rural', etiqueta: 'Escapada Rural', color: '#eab308', emoji: '🟨' },
    { id: 'bloqueo', etiqueta: 'Bloqueada', color: '#ef4444', emoji: '🟥' },
  ];

  // Estado de cobro de la reserva.
  const ESTADOS_PAGO = [
    { id: 'pendiente', etiqueta: 'Pendiente', color: 'var(--color-aviso)' },
    { id: 'parcial', etiqueta: 'Anticipo', color: 'var(--color-info)' },
    { id: 'pagado', etiqueta: 'Pagado', color: 'var(--color-exito)' },
  ];

  const TIPOS_UNIDAD = ['Apartamento', 'Casa completa', 'Habitación'];

  let estado = null;
  // Capa de reservas importadas de Airbnb (solo lectura; NO se persiste ni sincroniza).
  let overlayAirbnb = [];
  // Gancho opcional para la sincronización en la nube (Firebase). Si no hay
  // capa de sync registrada, todo funciona 100% local como siempre.
  let alGuardarRemoto = null;

  function estadoPorDefecto() {
    return {
      config: { nombreNegocio: 'AT El Sotillo', moneda: '€' },
      unidades: [],
      reservas: [],
      clientes: [],
    };
  }

  // Semilla con las 7 unidades REALES del alojamiento y la relación de bloqueo:
  // "El Sotillo 2" (casa completa) ocupa por dentro las Habitaciones 1..5.
  function datosIniciales() {
    const base = estadoPorDefecto();
    const habs = [
      { id: 'hab1', nombre: 'Habitación 1', tipo: 'Habitación', capacidad: 2, precioBase: 45 },
      { id: 'hab2', nombre: 'Habitación 2', tipo: 'Habitación', capacidad: 2, precioBase: 45 },
      { id: 'hab3', nombre: 'Habitación 3', tipo: 'Habitación', capacidad: 2, precioBase: 45 },
      { id: 'hab4', nombre: 'Habitación 4', tipo: 'Habitación', capacidad: 2, precioBase: 45 },
      { id: 'hab5', nombre: 'Habitación 5', tipo: 'Habitación', capacidad: 2, precioBase: 45 },
    ];
    base.unidades = [
      { id: 'apto1', nombre: 'Apartamento 1', tipo: 'Apartamento', capacidad: 4, precioBase: 85, componentes: [] },
      // La casa completa "contiene" las 5 habitaciones → reservarla las bloquea.
      { id: 'sotillo2', nombre: 'El Sotillo 2', tipo: 'Casa completa', capacidad: 10, precioBase: 220, componentes: ['hab1', 'hab2', 'hab3', 'hab4', 'hab5'] },
      ...habs.map((h) => ({ ...h, componentes: [] })),
    ];
    base.reservas = [];
    base.clientes = [];
    return base;
  }

  // ---- Persistencia (punto único de migración a Firebase) --------------
  function cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (crudo) { estado = JSON.parse(crudo); normalizar(); return; }
    } catch (err) {
      console.error('No se pudo leer el almacenamiento, se reinicia:', err);
    }
    estado = datosIniciales();
    guardar();
  }

  function normalizar() {
    if (!estado.config) estado.config = estadoPorDefecto().config;
    ['unidades', 'reservas', 'clientes'].forEach((k) => { if (!Array.isArray(estado[k])) estado[k] = []; });
    estado.unidades.forEach((u) => { if (!Array.isArray(u.componentes)) u.componentes = []; });
    // Migración: una versión anterior guardaba las reservas de Airbnb dentro del
    // estado; ahora son una capa aparte de solo lectura. Las quitamos de aquí.
    estado.reservas = estado.reservas.filter((r) => !r.importadaAirbnb);
    // Datos editables de las reservas de Airbnb (nombre, personas, precio…).
    if (!estado.airbnbDatos) estado.airbnbDatos = {};
    // Migración del antiguo mapa de limpieza al nuevo mapa de datos.
    if (estado.airbnbLimpieza) {
      Object.keys(estado.airbnbLimpieza).forEach((id) => {
        estado.airbnbDatos[id] = { ...(estado.airbnbDatos[id] || {}), limpiezaHecha: true };
      });
      delete estado.airbnbLimpieza;
    }
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (err) {
      console.error('No se pudo guardar:', err);
      if (window.AgendaUI) window.AgendaUI.toast('No se pudo guardar (almacenamiento lleno)', 'error');
    }
    // Empuja el cambio a la nube si hay sincronización activa (no bloquea el guardado local).
    if (alGuardarRemoto) { try { alGuardarRemoto(estado); } catch (e) { console.warn('sync push falló:', e); } }
  }

  // Registrado por la capa de sync (Firebase). El callback recibe el estado tras cada guardado.
  function registrarSync(callback) { alGuardarRemoto = callback; }

  // Aplica un estado llegado de la nube SIN volver a empujarlo (evita bucles).
  function aplicarRemoto(nuevoEstado) {
    estado = nuevoEstado;
    normalizar();
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* offline/lleno: se reintenta luego */ }
  }

  // ---- Acceso al estado
  function obtener() { return estado; }
  function config() { return estado.config; }
  function moneda() { return estado.config.moneda || '€'; }
  function origen(id) { return ORIGENES.find((o) => o.id === id) || ORIGENES[0]; }
  function estadoPago(id) { return ESTADOS_PAGO.find((e) => e.id === id) || ESTADOS_PAGO[0]; }

  // ---- Unidades
  function unidades() { return estado.unidades; }
  function unidadPorId(id) { return estado.unidades.find((u) => u.id === id) || null; }

  function guardarUnidad(datos) {
    if (datos.id && unidadPorId(datos.id)) {
      const idx = estado.unidades.findIndex((u) => u.id === datos.id);
      estado.unidades[idx] = { ...estado.unidades[idx], ...datos };
    } else {
      estado.unidades.push({ id: datos.id || U.idUnico('u'), componentes: [], ...datos });
    }
    guardar();
  }

  function eliminarUnidad(id) {
    estado.unidades = estado.unidades.filter((u) => u.id !== id);
    // Quitamos la unidad de los "componentes" de cualquier casa completa.
    estado.unidades.forEach((u) => { u.componentes = (u.componentes || []).filter((c) => c !== id); });
    guardar();
  }

  // ---- Reservas
  // Devuelve las reservas propias + la capa de Airbnb (solo lectura), fusionadas.
  function reservas() { return overlayAirbnb.length ? estado.reservas.concat(overlayAirbnb) : estado.reservas; }
  function reservaPorId(id) {
    return estado.reservas.find((r) => r.id === id) || overlayAirbnb.find((r) => r.id === id) || null;
  }

  function guardarReserva(datos) {
    if (datos.id && String(datos.id).startsWith('ab_')) return; // Airbnb: solo lectura
    if (datos.id && estado.reservas.some((r) => r.id === datos.id)) {
      const idx = estado.reservas.findIndex((r) => r.id === datos.id);
      estado.reservas[idx] = { ...estado.reservas[idx], ...datos };
    } else {
      estado.reservas.push({ id: U.idUnico('r'), creada: U.hoyISO(), ...datos });
    }
    if (datos.origen !== 'bloqueo') sincronizarCliente(datos);
    guardar();
  }

  function eliminarReserva(id) {
    estado.reservas = estado.reservas.filter((r) => r.id !== id);
    guardar();
  }

  // ---- Sincronización con calendarios externos (Airbnb, iCal) ----------
  // Las reservas de Airbnb se mantienen como una CAPA SUPERPUESTA de solo
  // lectura (`overlayAirbnb`), NO dentro del estado. No se guardan en local ni
  // se sincronizan con la nube: cada dispositivo las lee del mismo JSON público
  // (data/airbnb.json). Así la sincronización de Firebase (que reemplaza el
  // estado) nunca las borra, y no hay duplicados ni bucles entre dispositivos.
  // `items` = [{ uid, unidadId, entrada, salida, tipo }] (tipo: 'reserva'|'bloqueo').
  function aplicarAirbnb(items) {
    if (!Array.isArray(items)) { overlayAirbnb = []; return; }
    const extras = (estado && estado.airbnbDatos) || {};
    overlayAirbnb = items
      .filter((it) => it && it.uid && it.unidadId && it.entrada && it.salida)
      .map((it) => {
        const esBloqueo = it.tipo === 'bloqueo';
        const id = 'ab_' + it.uid;
        // Datos que el usuario haya añadido a mano (nombre, personas, precio…).
        const extra = extras[id] || {};
        return {
          id,
          importadaAirbnb: true,
          origen: esBloqueo ? 'bloqueo' : 'airbnb',
          cliente: extra.cliente != null ? extra.cliente : (esBloqueo ? '' : 'Reserva Airbnb'),
          telefono: extra.telefono != null ? extra.telefono : '',
          personas: extra.personas != null ? extra.personas : (esBloqueo ? 0 : 2),
          unidadId: it.unidadId,
          entrada: it.entrada,
          salida: it.salida,
          precioTotal: extra.precioTotal != null ? extra.precioTotal : 0,
          pagado: extra.pagado != null ? extra.pagado : 0,
          estadoPago: extra.estadoPago != null ? extra.estadoPago : 'pagado',
          observaciones: extra.observaciones != null ? extra.observaciones
            : (esBloqueo ? 'Airbnb · no disponible' : 'Importada de Airbnb'),
          limpiezaHecha: !!extra.limpiezaHecha,
        };
      });
  }

  // Guarda los datos que el usuario edita a mano en una reserva de Airbnb
  // (nombre, personas, precio…). Se guardan por UID en `estado.airbnbDatos`,
  // que SÍ se sincroniza con la nube y sobrevive a la actualización horaria.
  function guardarDatosAirbnb(id, datos) {
    if (!String(id).startsWith('ab_')) return;
    if (!estado.airbnbDatos) estado.airbnbDatos = {};
    estado.airbnbDatos[id] = { ...(estado.airbnbDatos[id] || {}), ...datos };
    // Reflejar el cambio en la capa en memoria de inmediato.
    const ov = overlayAirbnb.find((r) => r.id === id);
    if (ov) Object.assign(ov, datos);
    guardar();
  }

  // Marca (o desmarca) la limpieza hecha tras la salida de una reserva.
  function marcarLimpieza(id, hecha) {
    // Reservas de Airbnb: no están en el estado; guardamos el "hecho" en el
    // mapa airbnbDatos (por su UID estable), que sí se sincroniza.
    if (String(id).startsWith('ab_')) {
      guardarDatosAirbnb(id, { limpiezaHecha: !!hecha });
      return;
    }
    const r = reservaPorId(id);
    if (!r) return;
    r.limpiezaHecha = !!hecha;
    guardar();
  }

  function sincronizarCliente(datos) {
    const nombre = (datos.cliente || '').trim();
    if (!nombre) return;
    const existe = estado.clientes.find((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (!existe) {
      estado.clientes.push({ id: U.idUnico('c'), nombre, telefono: datos.telefono || '', observaciones: '' });
    } else if (!existe.telefono && datos.telefono) {
      existe.telefono = datos.telefono;
    }
  }

  // ---- Clientes
  function clientes() { return estado.clientes; }
  function clientePorId(id) { return estado.clientes.find((c) => c.id === id) || null; }

  function guardarCliente(datos) {
    if (datos.id && clientePorId(datos.id)) {
      const idx = estado.clientes.findIndex((c) => c.id === datos.id);
      estado.clientes[idx] = { ...estado.clientes[idx], ...datos };
    } else {
      estado.clientes.push({ id: U.idUnico('c'), ...datos });
    }
    guardar();
  }

  function eliminarCliente(id) {
    estado.clientes = estado.clientes.filter((c) => c.id !== id);
    guardar();
  }

  // ---- Config
  function guardarConfig(datos) { estado.config = { ...estado.config, ...datos }; guardar(); }

  // ---- Import / export / reinicio
  function exportarJSON() { return JSON.stringify(estado, null, 2); }

  function importarJSON(texto) {
    const datos = JSON.parse(texto);
    if (!datos || typeof datos !== 'object') throw new Error('Formato no válido');
    estado = datos;
    normalizar();
    guardar();
  }

  function reiniciar() { estado = datosIniciales(); guardar(); }

  window.AgendaStore = {
    ORIGENES, ESTADOS_PAGO, TIPOS_UNIDAD,
    cargar, guardar, obtener, config, moneda, origen, estadoPago,
    unidades, unidadPorId, guardarUnidad, eliminarUnidad,
    reservas, reservaPorId, guardarReserva, eliminarReserva, marcarLimpieza, aplicarAirbnb, guardarDatosAirbnb,
    clientes, clientePorId, guardarCliente, eliminarCliente,
    guardarConfig, exportarJSON, importarJSON, reiniciar,
    registrarSync, aplicarRemoto,
  };
})();
