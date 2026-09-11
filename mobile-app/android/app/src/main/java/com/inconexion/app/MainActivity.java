package com.inconexion.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Cliente ligero: esta Activity solo agrega comportamiento nativo alrededor
 * del WebView que carga el sitio real (server.url en capacitor.config.json).
 * No se toca public/ — toda la lógica/UI de negocio vive en el sitio web.
 *
 * Qué agrega respecto al comportamiento por defecto de Capacitor:
 *  - Oculta el splash cuando el sitio termina de cargar (no con un timer fijo,
 *    y con una salvaguarda de tiempo si la carga se queda colgada).
 *  - Pantalla de "sin conexión" propia en vez del error nativo de Chromium.
 *  - Botón/gesto atrás: retrocede en el WebView si hay historial, si no pide
 *    confirmación ("toca atrás de nuevo para salir") en vez de cerrar de golpe.
 *
 * Nota sobre el splash: el arranque/color/ícono de marca (Theme.SplashScreen
 * + windowSplashScreenBackground/AnimatedIcon en styles.xml) lo maneja
 * @capacitor/splash-screen por su cuenta (launchAutoHide:false en
 * capacitor.config.json) -- se probó tomar control 100% nativo de esto
 * (instalando el splash nosotros mismos) para que también se ocultara al
 * fallar la carga, pero eso introdujo una franja blanca/negra visible en la
 * transición, incluso en la carga exitosa normal (confirmado en dispositivo
 * real). Se revirtió: Capacitor renderiza limpio para el caso normal (la
 * gran mayoría de las veces), a costa de que si la PRIMERA carga falla por
 * red, el splash puede quedarse pegado sobre la pantalla de "sin conexión"
 * (igual funcional -- offline.html carga bien debajo -- pero no se ve hasta
 * que el splash se oculta solo). Ver PROGRESS.md para más detalle.
 */
public class MainActivity extends BridgeActivity {

    private static final long EXIT_CONFIRM_WINDOW_MS = 2000;
    private static final long LOAD_TIMEOUT_MS = 10000;
    private static final String OFFLINE_ASSET_URL = "file:///android_asset/offline.html";

    private long lastBackPressAt = 0L;
    private final Handler loadTimeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable loadTimeoutRunnable;

    private void cancelLoadTimeout() {
        if (loadTimeoutRunnable != null) {
            loadTimeoutHandler.removeCallbacks(loadTimeoutRunnable);
            loadTimeoutRunnable = null;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // @capacitor/status-bar NO aplica capacitor.config.json solo -- su
        // Plugin.load() solo crea la implementación nativa, sin leer
        // backgroundColor/style de la config (confirmado leyendo
        // StatusBarPlugin.java: solo actúa cuando JS llama a sus métodos, y
        // public/js no lo hace). Se fija acá, de forma nativa, el estado por
        // defecto para que combine con la marca desde el arranque; si algún
        // día el sitio llama a StatusBar.setStyle()/setBackgroundColor()
        // desde JS, eso simplemente lo pisa después, sin conflicto.
        getWindow().setStatusBarColor(ContextCompat.getColor(this, R.color.colorPrimary));
        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(false); // false = íconos claros, para fondo oscuro
        }

        Bridge bridge = this.bridge;
        WebView webView = bridge.getWebView();

        webView.setWebViewClient(new BridgeWebViewClient(bridge) {

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                cancelLoadTimeout();
                // Salvaguarda: con el teléfono sin NINGUNA interfaz de red
                // activa (wifi y datos apagados a la vez), confirmado en
                // dispositivo real, Chromium a veces se queda esperando
                // bastante más de lo normal en vez de disparar
                // onReceivedError rápido (parece un tema de a qué tan al día
                // está el estado de conectividad que ve Chromium justo
                // después de apagar los radios, no algo 100% determinístico).
                // Si la carga real (no offline.html, para no encadenarse en
                // loop) no termina en LOAD_TIMEOUT_MS, se fuerza igual la
                // pantalla de "sin conexión".
                if (!url.startsWith("file://")) {
                    loadTimeoutRunnable = () -> goOffline(view);
                    loadTimeoutHandler.postDelayed(loadTimeoutRunnable, LOAD_TIMEOUT_MS);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                cancelLoadTimeout();
                // launchAutoHide:false en capacitor.config.json → el splash
                // (@capacitor/splash-screen) se oculta manualmente aquí, recién
                // cuando el WebView terminó de cargar la página actual (el
                // sitio real o, si falló, offline.html). Es idempotente: si el
                // splash ya estaba oculto, esta llamada no hace nada.
                //
                // Limitación conocida: window.Capacitor no existe en
                // offline.html ni en la página que falló al cargar
                // (confirmado en dispositivo real con logs: "Capacitor
                // presente=false" en ambos casos), porque el bridge de
                // Capacitor se inyecta como parte de una carga EXITOSA de la
                // página real -- así que si la primera carga de la app falla
                // por red, este hide() no tiene efecto y el splash puede
                // quedar pegado sobre offline.html (que sí carga bien
                // debajo). Se intentó un manejo 100% nativo del splash para
                // cubrir también ese caso, pero introducía una franja
                // blanca/negra visible en la transición normal (la de todos
                // los días) -- se revirtió, prioriza que el caso común
                // renderice limpio. Ver PROGRESS.md.
                view.evaluateJavascript(
                    "if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {" +
                    " window.Capacitor.Plugins.SplashScreen.hide(); }",
                    null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && isConnectivityError(error.getErrorCode())) {
                    cancelLoadTimeout();
                    goOffline(view);
                    return;
                }
                super.onReceivedError(view, request, error);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                // Fallback para API < 23 (minSdk 22), donde no existe el
                // overload con WebResourceRequest/WebResourceError de arriba.
                if (isConnectivityError(errorCode)) {
                    cancelLoadTimeout();
                    goOffline(view);
                    return;
                }
                super.onReceivedError(view, errorCode, description, failingUrl);
            }

            private void goOffline(WebView view) {
                view.setBackgroundColor(0xFF0D4A5E);
                view.loadUrl(OFFLINE_ASSET_URL);
            }

            private boolean isConnectivityError(int code) {
                return code == WebViewClient.ERROR_HOST_LOOKUP
                    || code == WebViewClient.ERROR_CONNECT
                    || code == WebViewClient.ERROR_TIMEOUT
                    || code == WebViewClient.ERROR_IO
                    || code == WebViewClient.ERROR_UNKNOWN;
            }
        });
    }

    @Override
    public void onBackPressed() {
        WebView webView = this.bridge.getWebView();

        // La app es una SPA de una sola URL (public/js no usa pushState ni
        // rutas por hash), así que el WebView casi nunca tiene historial de
        // navegación real que recorrer con goBack(). Este canGoBack() queda
        // como manejo correcto para el caso en que sí lo haya (por ejemplo,
        // tras pasar por la pantalla de "sin conexión" y volver a cargar el
        // sitio). El caso normal (salir de un dashboard) es manejado del lado
        // del sitio, no aquí.
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastBackPressAt < EXIT_CONFIRM_WINDOW_MS) {
            // finish() directo, NO super.onBackPressed(): Capacitor registra su
            // propio OnBackPressedCallback (para el evento JS 'backButton') en
            // el dispatcher de ComponentActivity, y como public/js no tiene
            // ningún listener para ese evento, ese callback consume el back
            // press sin hacer nada -- super.onBackPressed() quedaba absorbido
            // ahí y la app nunca cerraba en el segundo toque (confirmado en
            // dispositivo real: el proceso seguía vivo). finish() evita esa
            // cadena por completo.
            finish();
            return;
        }
        lastBackPressAt = now;
        Toast.makeText(this, "Toca atrás de nuevo para salir", Toast.LENGTH_SHORT).show();
    }
}
