/* ============================================================
   firebase-config.js — CONFIGURACIÓN DE LA NUBE (la rellenas TÚ)

   Mientras `activo` sea false, la app funciona igual que hasta ahora:
   100% local, sin conexión y sin Firebase. No necesitas tocar nada más
   para que siga funcionando en local.

   Para ACTIVAR la nube (base de datos compartida + login de 2 usuarios):
   ver la guía paso a paso en  firebase/GUIA-FIREBASE.md
     1. Crea un proyecto gratuito en https://console.firebase.google.com
     2. Activa Authentication → Email/Password y crea tus 2 usuarios.
     3. Crea una base de datos Firestore (modo producción).
     4. Copia aquí la config del proyecto (Configuración → Tus apps → SDK).
     5. Pon `activo: true` y publica las reglas de firebase/firestore.rules
   ============================================================ */
window.AGENDA_FIREBASE = {
  // ⬇️ Pon esto en true cuando hayas rellenado `config` y creado los usuarios.
  activo: false,

  // Identificador del documento compartido por los 2 usuarios.
  // Déjalo así; si lo cambias DESPUÉS de usarlo, empezarías una agenda nueva.
  espacioId: 'el-sotillo',

  // ⬇️ Pega aquí los datos de TU proyecto (son claves públicas de cliente;
  //     la seguridad real la dan las reglas de Firestore + el login).
  config: {
    apiKey: 'TU_API_KEY',
    authDomain: 'TU_PROYECTO.firebaseapp.com',
    projectId: 'TU_PROYECTO',
    storageBucket: 'TU_PROYECTO.appspot.com',
    messagingSenderId: 'TU_SENDER_ID',
    appId: 'TU_APP_ID',
  },

  // Versión del SDK de Firebase que se carga desde el CDN de Google.
  versionSDK: '10.12.5',
};
