/* ============================================================
   sync-firebase.js — AT El Sotillo Manager · sincronización en la nube.

   ANDAMIAJE listo: mientras firebase-config.js tenga `activo: false`,
   este archivo no hace nada y la app es 100% local. Al activarlo:
     · Carga el SDK de Firebase desde el CDN de Google (bajo demanda).
     · Login por email/contraseña (los 2 usuarios que crees en Firebase).
     · Sincroniza el estado completo en tiempo real entre dispositivos
       (documento agendas/{espacioId} en Firestore).

   Diseño offline-first: el trabajo se guarda SIEMPRE en local primero;
   la nube es un espejo. Si no hay red o el SDK no carga, la app sigue
   funcionando y se sincroniza cuando vuelve la conexión.

   Concurrencia: la fusión es "último en escribir gana" a nivel de todo
   el documento. Perfecto para 2 usuarios que rara vez editan a la vez;
   si en el futuro hay más edición simultánea, pasar a una colección por
   reserva (ver firebase/GUIA-FIREBASE.md, "Escalar la sincronización").
   ============================================================ */
(function () {
  'use strict';

  const S = window.AgendaStore;

  // API pública (la usa Ajustes y la insignia de cabecera).
  const Sync = {
    disponible: false,      // hay config activa
    estado: 'sin-config',   // sin-config | conectando | sin-sesion | conectado | error
    usuario: null,          // email del usuario conectado
    mensaje: '',
    iniciarSesion: async () => {},
    cerrarSesion: async () => {},
    abrirLogin: () => {},
    alCambiar: (cb) => { oyentes.push(cb); },
  };
  const oyentes = [];
  function notificar() {
    actualizarInsignia();
    oyentes.forEach((cb) => { try { cb(Sync); } catch (e) { /* noop */ } });
  }
  function fijarEstado(estado, mensaje) {
    Sync.estado = estado;
    Sync.mensaje = mensaje || '';
    notificar();
  }

  window.AgendaSync = Sync;

  const cfg = window.AGENDA_FIREBASE;
  if (!cfg || !cfg.activo) {
    // Nube no configurada: la app se queda en local. Nada más que hacer.
    Sync.estado = 'sin-config';
    document.addEventListener('DOMContentLoaded', actualizarInsignia);
    return;
  }

  Sync.disponible = true;
  document.addEventListener('DOMContentLoaded', () => { arrancar(); });

  // --- Referencias del SDK (se rellenan al cargar) ---
  let fb = null; // { auth, db, authFns, dbFns, docRef }
  let escribiendo = false; // evita re-empujar lo que acabamos de recibir
  let pushPendiente = null;

  async function arrancar() {
    actualizarInsignia();
    fijarEstado('conectando', 'Conectando con la nube…');
    try {
      const V = cfg.versionSDK || '10.12.5';
      const base = `https://www.gstatic.com/firebasejs/${V}`;
      const [appMod, authFns, dbFns] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`),
      ]);
      const app = appMod.initializeApp(cfg.config);
      const auth = authFns.getAuth(app);
      const db = dbFns.getFirestore(app);
      const docRef = dbFns.doc(db, 'agendas', cfg.espacioId || 'principal');
      fb = { auth, db, authFns, dbFns, docRef };

      // Mantener la sesión iniciada entre visitas.
      try { await authFns.setPersistence(auth, authFns.browserLocalPersistence); } catch (e) { /* noop */ }

      Sync.iniciarSesion = iniciarSesion;
      Sync.cerrarSesion = cerrarSesion;
      Sync.abrirLogin = abrirLogin;

      authFns.onAuthStateChanged(auth, (usuario) => {
        if (usuario) {
          Sync.usuario = usuario.email;
          fijarEstado('conectado', 'Sincronizando…');
          iniciarSincronizacion();
        } else {
          Sync.usuario = null;
          fijarEstado('sin-sesion', 'Inicia sesión para sincronizar');
          abrirLogin();
        }
      });
    } catch (err) {
      console.error('Firebase no disponible (se sigue en local):', err);
      fijarEstado('error', 'Sin conexión con la nube — trabajando en local');
    }
  }

  // --- Sincronización del documento completo ---
  let desuscribir = null;
  async function iniciarSincronizacion() {
    if (desuscribir) return; // ya activa
    const { dbFns, docRef } = fb;

    // 1) Carga inicial: si hay datos remotos, adoptarlos; si no, sembrar con lo local.
    try {
      const snap = await dbFns.getDoc(docRef);
      if (snap.exists() && snap.data() && snap.data().estado) {
        S.aplicarRemoto(snap.data().estado);
        repintar();
      } else {
        await empujar(S.obtener());
      }
    } catch (e) {
      console.warn('Carga inicial de la nube falló:', e);
    }

    // 2) Escucha cambios del otro usuario en tiempo real.
    desuscribir = dbFns.onSnapshot(docRef, (snap) => {
      if (snap.metadata.hasPendingWrites) return; // es nuestro propio cambio
      const data = snap.data();
      if (data && data.estado) {
        escribiendo = true;
        S.aplicarRemoto(data.estado);
        escribiendo = false;
        repintar();
      }
    }, (err) => console.warn('onSnapshot error:', err));

    // 3) Empuja a la nube cada guardado local (con leve retardo para agrupar).
    S.registrarSync((estado) => {
      if (escribiendo) return;
      clearTimeout(pushPendiente);
      pushPendiente = setTimeout(() => empujar(estado), 500);
    });

    fijarEstado('conectado', 'Sincronizado');
  }

  async function empujar(estado) {
    if (!fb || !fb.auth.currentUser) return;
    try {
      await fb.dbFns.setDoc(fb.docRef, {
        estado,
        actualizado: fb.dbFns.serverTimestamp(),
        por: fb.auth.currentUser.email,
      });
    } catch (e) {
      console.warn('No se pudo subir a la nube (se reintenta al próximo cambio):', e);
    }
  }

  function repintar() {
    if (window.AgendaApp) {
      window.AgendaApp.actualizarCabecera();
      window.AgendaApp.repintar();
    }
  }

  // --- Autenticación ---
  async function iniciarSesion(email, password) {
    if (!fb) throw new Error('Nube no cargada');
    await fb.authFns.signInWithEmailAndPassword(fb.auth, email, password);
  }

  async function cerrarSesion() {
    if (!fb) return;
    if (desuscribir) { desuscribir(); desuscribir = null; }
    S.registrarSync(null);
    await fb.authFns.signOut(fb.auth);
  }

  function abrirLogin() {
    if (!window.AgendaUI) return;
    window.AgendaUI.abrirModal('☁️ Acceso a la nube', `
      <p class="suave" style="margin-top:0">Inicia sesión para sincronizar la agenda entre dispositivos.</p>
      <form id="formLoginNube">
        <div class="campo"><label>Email</label><input name="email" type="email" required autocomplete="username" /></div>
        <div class="campo"><label>Contraseña</label><input name="password" type="password" required autocomplete="current-password" /></div>
        <div id="loginError" class="aviso-conflicto" style="display:none"></div>
        <div class="modal__pie">
          <button type="button" class="btn" id="loginLocal">Seguir en local</button>
          <button type="submit" class="btn btn--primario btn--grande">Entrar</button>
        </div>
      </form>
    `);
    const form = document.getElementById('formLoginNube');
    document.getElementById('loginLocal').onclick = window.AgendaUI.cerrarModal;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const err = document.getElementById('loginError');
      err.style.display = 'none';
      try {
        await iniciarSesion(form.email.value.trim(), form.password.value);
        window.AgendaUI.cerrarModal();
        window.AgendaUI.toast('Conectado a la nube ☁️', 'exito');
      } catch (ex) {
        err.textContent = traducirError(ex);
        err.style.display = 'block';
      }
    };
  }

  function traducirError(ex) {
    const c = (ex && ex.code) || '';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Email o contraseña incorrectos.';
    if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera un momento.';
    if (c.includes('network')) return 'Sin conexión. Puedes seguir trabajando en local.';
    return 'No se pudo iniciar sesión: ' + (ex.message || c);
  }

  // --- Insignia de estado en la cabecera ---
  function actualizarInsignia() {
    const cabecera = document.querySelector('.app-header__brand');
    if (!cabecera) return;
    let insignia = document.getElementById('nubeInsignia');
    if (!insignia) {
      insignia = document.createElement('button');
      insignia.id = 'nubeInsignia';
      insignia.className = 'nube-insignia';
      insignia.onclick = () => {
        if (Sync.estado === 'conectado') { if (window.AgendaApp) window.AgendaApp.irA('ajustes'); }
        else if (Sync.disponible) Sync.abrirLogin();
      };
      cabecera.appendChild(insignia);
    }
    const mapa = {
      'sin-config': { txt: '', cls: '' },
      conectando: { txt: '☁️ …', cls: 'nube-insignia--conectando' },
      'sin-sesion': { txt: '☁️ Entrar', cls: 'nube-insignia--aviso' },
      conectado: { txt: '☁️ En la nube', cls: 'nube-insignia--ok' },
      error: { txt: '⚠️ Local', cls: 'nube-insignia--aviso' },
    };
    const m = mapa[Sync.estado] || mapa['sin-config'];
    insignia.textContent = m.txt;
    insignia.className = 'nube-insignia ' + m.cls;
    insignia.style.display = m.txt ? '' : 'none';
    insignia.title = Sync.usuario ? `Conectado como ${Sync.usuario}` : (Sync.mensaje || '');
  }
})();
