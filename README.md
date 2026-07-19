# AT El Sotillo Manager

Aplicación para gestionar las reservas del alojamiento turístico **AT El Sotillo**.
PWA instalable en Android, iPhone y ordenador. Funciona **sin conexión** y **sin
cuotas**. Diseño limpio, fondo blanco, botones grandes, pensada para usarse con una mano.

> Estado: **Fase 1 completada** (local-first). La sincronización en la nube con
> Firebase y el acceso con usuario están planificados para las siguientes fases
> (ver más abajo) — requieren tu cuenta de Firebase.

---

## ⭐ La función estrella

Reservar **El Sotillo 2** (la casa completa) **bloquea automáticamente** las
Habitaciones 1 a 5. Y si cualquiera de esas habitaciones ya está ocupada, la app
**no deja guardar** la reserva de la casa completa. Funciona en los dos sentidos.

Cómo está resuelto (`js/model.js`): cada unidad ocupa un conjunto de *espacios
físicos* = `{ ella } ∪ { sus componentes }`. Dos reservas chocan si sus espacios
se cruzan y sus fechas se solapan.

- **El Sotillo 2** → `{sotillo2, hab1, hab2, hab3, hab4, hab5}`
- **Habitación 3** → `{hab3}` → se cruzan → **conflicto** 🚫
- **Habitación 1** vs **Habitación 2** → `{hab1}` vs `{hab2}` → no se cruzan → **compatibles** ✅

Qué habitaciones bloquea cada casa se configura en **Unidades → Editar** (casilla
"Habitaciones que bloquea"). El Apartamento 1 es independiente.

---

## Cómo usarla

Es HTML + JavaScript **sin dependencias ni compilación**.

- **Probar en el ordenador:** abrir `agenda/index.html` en el navegador. (Para que
  el service worker y la instalación PWA funcionen hace falta servirla por HTTP,
  no `file://`.)
- **Servir en local:**
  ```sh
  cd agenda
  python3 -m http.server 8200
  # abrir http://localhost:8200
  ```
- **Instalar como app:** abre la URL en Chrome/Safari → menú → "Añadir a pantalla
  de inicio" / "Instalar app".

Los datos se guardan en el propio dispositivo (`localStorage`). En **Ajustes**
puedes **descargar una copia de seguridad** (JSON) y **restaurarla** en otro
dispositivo. Empieza sembrada con las 7 unidades reales de El Sotillo.

---

## Publicación en GitHub Pages

Hay un workflow (`.github/workflows/deploy-agenda-pages.yml`) que publica esta
carpeta `agenda/` como **raíz** del sitio. La app queda en:

```
https://josuiru.github.io/mesa-mezclas/
```

Pasos (una sola vez):

1. En GitHub: **Settings → Pages → Source: “GitHub Actions”**.
2. El workflow se ejecuta solo al hacer push (o desde la pestaña **Actions →
   Run workflow**). Cuando termine, la URL de arriba estará viva.
3. Abre esa URL en el móvil → menú → **Añadir a pantalla de inicio** para
   instalarla como app.

> La primera ejecución fallará si aún no has puesto el Source en “GitHub Actions”
> (paso 1). Actívalo y vuelve a lanzar el workflow.

## Pantallas

| Pantalla | Qué hace |
|----------|----------|
| **Inicio** | Ocupación e ingresos del mes, entradas/salidas de hoy, cobros pendientes. |
| **Planning** | Calendario mensual por unidad. Reservas coloreadas por origen; los días bloqueados por la función estrella salen rayados en rojo. Clic en un hueco → reservar. **Arrastra** una reserva para moverla, **tira de los bordes** para cambiar fechas, y **🔎 Disponibilidad** para buscar unidades libres entre dos fechas. |
| **Reservas** | Listado con filtros y búsqueda. Alta/edición con validación anti-solape. Export CSV. |
| **Clientes** | Directorio (nombre, teléfono, observaciones) con historial por cliente. |
| **Limpieza** | Unidades pendientes de limpieza tras cada salida; marca "urgente" si entra otro huésped ese día o al siguiente. Botón "✓ Limpio". Próximas salidas a 7 días. |
| **Estadísticas** | Por año: ingresos, ocupación media, nº de reservas, estancia media y precio medio por noche; gráficos de ocupación e ingresos por mes, y desglose por origen y por unidad. |
| **Unidades** | Alta/edición de alojamientos y configuración del bloqueo compuesto. |
| **Ajustes** | Datos del negocio, copias de seguridad, reinicio. |

### Colores por origen (planning)

🟩 Directa · 🩷 Airbnb · 🟨 Escapada Rural · 🟥 Bloqueada (mantenimiento/uso propio) · ⚪ Libre

---

## Estructura del código

```
agenda/
├── index.html              Punto de entrada; carga los scripts en orden
├── manifest.webmanifest    Metadatos PWA (instalación)
├── sw.js                   Service worker (funcionamiento offline)
├── icons/icon.svg          Icono de la app
├── css/styles.css          Estilos (limpio, blanco, móvil-first)
└── js/
    ├── util.js             Fechas, dinero, DOM
    ├── store.js            Estado + persistencia  ← punto único de migración a la nube
    ├── model.js            Lógica de negocio (⭐ función estrella, métricas)
    ├── ui.js               Modal, toasts, confirmaciones
    ├── panel.js            Vista Inicio
    ├── calendario.js       Vista Planning
    ├── reservas.js         Reservas (form + validación anti-solape)
    ├── clientes.js         Clientes
    ├── limpieza.js         Limpieza (pendientes tras cada salida)
    ├── estadisticas.js     Estadísticas del año (gráficos CSS)
    ├── alojamientos.js     Unidades
    ├── ajustes.js          Configuración y copias
    └── app.js              Enrutado y arranque
```

Todo se comunica por objetos globales `window.Agenda*` (mismo estilo vanilla que el
resto del repo). Cada símbolo se define en un único archivo.

---

## Hoja de ruta

- **Fase 1 — hecho ✅**: estructura, pantallas, base de datos local, diseño limpio,
  planning, alta de reservas, función estrella (anti-conflictos), PWA instalable
  y offline, copias de seguridad.
- **Fase 2 — hecho ✅**: arrastrar reservas en el planning para **moverlas** (otra
  unidad y/o fechas, conservando las noches) y **redimensionarlas** tirando de los
  bordes; **búsqueda de disponibilidad** entre dos fechas. Todo respeta la función
  estrella: si el destino solapa, se revierte con aviso.
- **Fase 3 — hecho ✅**: limpieza (estado de cada unidad tras cada salida, con
  aviso de urgencia) y estadísticas avanzadas (ocupación e ingresos por mes,
  desglose por origen y por unidad, ADR y estancia media).
- **Fase 4 — nube y publicación**: **andamiaje listo** ✅ (código de Firebase
  preparado, a la espera de tus claves). Ver abajo.

### La nube (Firebase) — Fase 4

El **andamiaje ya está hecho**: sincronización en la nube + login de 2 usuarios,
sin tocar ninguna pantalla. Sólo falta que pegues las claves de tu proyecto
Firebase y lo actives.

- **Guía paso a paso (15–20 min, sin programar):** [`firebase/GUIA-FIREBASE.md`](firebase/GUIA-FIREBASE.md)
- **Configuración que rellenas tú:** `js/firebase-config.js` (`activo: false` por defecto)
- **Reglas de seguridad listas para publicar:** `firebase/firestore.rules`
- **Capa de sincronización:** `js/sync-firebase.js` (offline-first; carga el SDK
  bajo demanda; documento `agendas/{espacioId}` en tiempo real)

Cómo encaja sin reescribir pantallas: toda la persistencia está aislada en
`js/store.js`. La capa de sync se engancha con `registrarSync()` (empujar cambios
locales a la nube) y `aplicarRemoto()` (recibir cambios del otro usuario). Mientras
`activo` sea `false`, la app es 100% local exactamente como hasta ahora.

Las **copias de seguridad manuales** (Ajustes → Descargar copia) siguen disponibles
en local y en la nube.
