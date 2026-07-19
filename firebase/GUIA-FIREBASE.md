# Activar la nube (Firebase) — guía paso a paso

Con esto la agenda se **sincroniza entre todos tus dispositivos** (tu móvil, el de
otra persona, el ordenador) y se protege con **usuario y contraseña**. Es gratis
dentro del plan *Spark* de Firebase, de sobra para un alojamiento.

Tiempo estimado: **15–20 minutos**, una sola vez. No hay que programar nada:
solo copiar y pegar unos datos.

> Mientras no hagas esto, la app funciona igual que ahora (guardando en el
> dispositivo). Activar la nube **no borra** tus datos locales: al conectarte por
> primera vez, si la nube está vacía, se suben tus datos actuales.

---

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. **Añadir proyecto** → nombre, por ejemplo `at-el-sotillo` → crear (puedes
   desactivar Google Analytics, no hace falta).

## 2. Registrar la app web

1. En la pantalla del proyecto, pulsa el icono **`</>`** (“Web”).
2. Ponle un apodo (p. ej. `El Sotillo Manager`) y **Registrar app**.
3. Firebase te mostrará un bloque `const firebaseConfig = { ... }`.
   Copia esos valores.

## 3. Pegar la configuración en la app

Abre `agenda/js/firebase-config.js` y rellena `config` con tus valores, y cambia
`activo` a `true`:

```js
window.AGENDA_FIREBASE = {
  activo: true,                 // ← ponlo en true
  espacioId: 'el-sotillo',
  config: {
    apiKey: '...',
    authDomain: 'at-el-sotillo.firebaseapp.com',
    projectId: 'at-el-sotillo',
    storageBucket: 'at-el-sotillo.appspot.com',
    messagingSenderId: '...',
    appId: '...',
  },
  versionSDK: '10.12.5',
};
```

> Estas claves son públicas de cliente (van en el navegador); no son un secreto.
> La seguridad real la dan el login y las reglas del paso 5.

## 4. Crear los usuarios (login de 2 personas)

1. En el menú lateral: **Compilación → Authentication → Comenzar**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
3. Pestaña **Users → Agregar usuario**. Crea las cuentas (p. ej. tú y la otra
   persona) con email y contraseña. Repite para el segundo usuario.

## 5. Crear la base de datos y publicar las reglas

1. Menú: **Compilación → Firestore Database → Crear base de datos**.
2. Elige **modo de producción** y una ubicación cercana (p. ej. `eur3` Europa).
3. Ve a la pestaña **Reglas**, borra lo que haya y pega el contenido de
   `agenda/firebase/firestore.rules`. Pulsa **Publicar**.

## 6. Autorizar tu dominio (si publicas la app en una web)

Si abres la app desde una URL propia (no `localhost`), en **Authentication →
Settings → Authorized domains** añade ese dominio. `localhost` ya viene
autorizado para pruebas.

## 7. Probar

1. Sirve la app por HTTP (no `file://`):
   ```sh
   cd agenda && python3 -m http.server 8200
   ```
2. Abre `http://localhost:8200`. Arriba verás **☁️ Entrar** → inicia sesión con
   uno de los usuarios creados. La insignia pasará a **☁️ En la nube**.
3. Abre la app en otro dispositivo/navegador, inicia sesión con el otro usuario y
   comprueba que una reserva creada en uno **aparece en el otro** en segundos.

---

## Copias de seguridad automáticas

- **Manual (ya disponible):** Ajustes → *Descargar copia (JSON)*. Guárdala en tu
  correo o nube. Recomendado hacerlo de vez en cuando.
- **Automática en Firebase:** en Firestore puedes activar exportaciones
  programadas a Cloud Storage (menú Firestore → *Copias de seguridad*). Requiere
  activar la facturación *Blaze* (sigue siendo gratis dentro de la cuota, solo
  pide una tarjeta). Opcional; con la copia manual periódica ya estás protegido.

## ¿Y si me equivoco o quiero volver a local?

Pon `activo: false` en `firebase-config.js`. La app vuelve a funcionar solo en
local, sin tocar tus datos.

---

## Escalar la sincronización (futuro, opcional)

Ahora se sincroniza **todo el documento** de la agenda con la política “el último
que guarda, gana”. Es ideal para 2 personas que rara vez editan exactamente a la
vez. Si algún día sois más gente editando en simultáneo, conviene pasar a **una
colección por reserva** (un documento Firestore por reserva) para fusionar cambios
a nivel de reserva. El código está aislado en `js/sync-firebase.js` y
`js/store.js` (funciones `registrarSync` y `aplicarRemoto`), así que ese cambio no
afecta a ninguna pantalla.
