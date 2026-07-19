# App Android (APK)

Envoltorio Android nativo de la PWA. Es un WebView que carga la versión web
publicada en GitHub Pages (`https://josuiru.github.io/at-el-sotillo-manager/`),
así que **se actualiza sola** y sincroniza con la nube (Firebase) igual que en el
navegador. El almacenamiento local y el modo sin conexión de la PWA siguen
funcionando dentro de la app.

## Cómo obtener el APK (sin compilar nada)

El APK se compila automáticamente en GitHub Actions y se publica en la sección
**Releases** del repositorio:

<https://github.com/JosuIru/at-el-sotillo-manager/releases>

1. Entra en Releases → **App Android (APK)** → descarga `at-el-sotillo-manager.apk`.
2. Ábrelo en el móvil. Android pedirá permitir "instalar apps de origen
   desconocido" para tu navegador o gestor de archivos: acéptalo.
3. Pulsa **Instalar**. Tendrás la app **El Sotillo** en el cajón de aplicaciones.

El APK va firmado con la clave de depuración (debug), suficiente para instalarlo
en tus dispositivos. No sirve para publicarlo en Google Play; para eso haría
falta firmarlo con una clave de subida propia.

## Volver a compilar

Cada vez que cambie algo dentro de `android/` y se haga push a `main`, el workflow
`.github/workflows/build-android.yml` genera un APK nuevo y actualiza la release
`android-latest`. También se puede lanzar a mano desde la pestaña **Actions →
Construir APK Android → Run workflow**.

## Compilar en local (opcional)

Requiere JDK 17 y el SDK de Android:

```sh
cd android
gradle assembleDebug          # o ./gradlew si generas el wrapper
# APK en: app/build/outputs/apk/debug/app-debug.apk
```
