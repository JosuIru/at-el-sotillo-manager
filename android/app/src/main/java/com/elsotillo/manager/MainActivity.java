package com.elsotillo.manager;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Envoltorio Android de la PWA "AT El Sotillo Manager".
 *
 * Carga la aplicación web publicada en GitHub Pages dentro de un WebView.
 * El almacenamiento local (localStorage) y el service worker de la PWA siguen
 * funcionando, así que la app funciona sin conexión igual que en el navegador.
 * Firebase (login + sincronización en la nube) funciona porque el dominio
 * josuiru.github.io está autorizado en la consola de Firebase.
 */
public class MainActivity extends Activity {

    private static final String URL_APP = "https://josuiru.github.io/at-el-sotillo-manager/";

    private WebView webView;
    private ValueCallback<Uri[]> selectorArchivos;
    private static final int CODIGO_SELECTOR = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings ajustes = webView.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setDatabaseEnabled(true);
        ajustes.setCacheMode(WebSettings.LOAD_DEFAULT);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        ajustes.setSupportZoom(false);
        ajustes.setLoadWithOverviewMode(true);
        ajustes.setUseWideViewPort(true);

        // Navegación interna: todo lo del propio dominio se abre en el WebView.
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !(url.startsWith("https://josuiru.github.io") || url.startsWith("about:"));
            }
        });

        // Diálogo de selección de archivo (restaurar copia de seguridad).
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (selectorArchivos != null) {
                    selectorArchivos.onReceiveValue(null);
                }
                selectorArchivos = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Selecciona una copia"), CODIGO_SELECTOR);
                } catch (Exception e) {
                    selectorArchivos = null;
                    return false;
                }
                return true;
            }
        });

        // Descargas: las copias de seguridad se generan como URL blob: dentro de
        // la página; las interceptamos, las leemos en base64 y las guardamos.
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url.startsWith("blob:")) {
                webView.evaluateJavascript(scriptLeerBlob(url, mimetype), null);
            } else if (url.startsWith("data:")) {
                try {
                    String base64 = url.substring(url.indexOf(",") + 1);
                    guardarEnDescargas(nombrePorDefecto(), base64, mimetype);
                } catch (Exception e) {
                    aviso("No se pudo descargar el archivo");
                }
            }
        });

        webView.addJavascriptInterface(new DescargadorAndroid(), "DescargadorAndroid");

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(URL_APP);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == CODIGO_SELECTOR) {
            if (selectorArchivos == null) return;
            Uri[] resultado = null;
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                resultado = new Uri[]{ data.getData() };
            }
            selectorArchivos.onReceiveValue(resultado);
            selectorArchivos = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    /** JS que descarga el contenido de un blob: y lo devuelve en base64 a Android. */
    private String scriptLeerBlob(String urlBlob, String mimetype) {
        return "(function(){"
                + "var xhr=new XMLHttpRequest();"
                + "xhr.open('GET','" + urlBlob + "',true);"
                + "xhr.responseType='blob';"
                + "xhr.onload=function(){if(this.status===200){"
                + "var reader=new FileReader();"
                + "reader.onloadend=function(){"
                + "var base64=reader.result.split(',')[1];"
                + "window.DescargadorAndroid.guardar(base64,'" + mimetype + "');"
                + "};reader.readAsDataURL(this.response);}};"
                + "xhr.send();})();";
    }

    private String nombrePorDefecto() {
        return "copia-elsotillo.json";
    }

    /** Interfaz llamada desde JavaScript para guardar el archivo descargado. */
    public class DescargadorAndroid {
        @JavascriptInterface
        public void guardar(String base64, String mimetype) {
            guardarEnDescargas(nombrePorDefecto(), base64, mimetype);
        }
    }

    private void guardarEnDescargas(String nombre, String base64, String mimetype) {
        try {
            byte[] datos = Base64.decode(base64, Base64.DEFAULT);
            if (mimetype == null || mimetype.isEmpty()) mimetype = "application/json";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContentResolver();
                ContentValues valores = new ContentValues();
                valores.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, nombre);
                valores.put(android.provider.MediaStore.Downloads.MIME_TYPE, mimetype);
                valores.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                Uri coleccion = android.provider.MediaStore.Downloads
                        .getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri item = resolver.insert(coleccion, valores);
                if (item == null) { aviso("No se pudo crear el archivo"); return; }
                try (OutputStream os = resolver.openOutputStream(item)) {
                    if (os != null) os.write(datos);
                }
                valores.clear();
                valores.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(item, valores, null, null);
                aviso("Copia guardada en Descargas: " + nombre);
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File archivo = new File(dir, nombre);
                try (FileOutputStream fos = new FileOutputStream(archivo)) {
                    fos.write(datos);
                }
                aviso("Copia guardada en: " + archivo.getAbsolutePath());
            }
        } catch (Exception e) {
            aviso("No se pudo guardar la copia");
        }
    }

    private void aviso(String texto) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, texto, Toast.LENGTH_LONG).show());
    }
}
