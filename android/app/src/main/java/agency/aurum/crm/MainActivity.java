package agency.aurum.crm;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Aurum en el móvil.
 *
 * La aplicación va DENTRO del APK: `assets/web/` es la misma exportación
 * estática que lleva el instalador de escritorio. No hay ninguna URL que abrir,
 * ni navegador de por medio.
 *
 * Se sirve con WebViewAssetLoader, que la publica bajo un origen https real
 * (appassets.androidplatform.net). Eso importa: un `file://` no tiene origen
 * propio, y Supabase guarda ahí la sesión — habría que iniciar sesión en cada
 * arranque, y las llamadas a la API fallarían por CORS. Quién resuelve cada
 * ruta a su fichero está en WebAssets.
 */
public class MainActivity extends Activity {

  private static final String HOST = "appassets.androidplatform.net";
  private static final String INICIO = "https://" + HOST + "/";

  private WebView web;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle saved) {
    super.onCreate(saved);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      getWindow().setStatusBarColor(Color.parseColor("#080808"));
      getWindow().setNavigationBarColor(Color.parseColor("#080808"));
    }

    // En la raíz del dominio, no bajo un prefijo: los enlaces y los scripts
    // de la aplicación son absolutos.
    final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
        .setDomain(HOST)
        .addPathHandler("/", new WebAssets(getAssets()))
        .build();

    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor("#080808"));
    web.setLayoutParams(new ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true); // aquí vive la sesión de Supabase
    s.setDatabaseEnabled(true);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setSupportZoom(false);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);

    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

    web.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return loader.shouldInterceptRequest(request.getUrl());
      }

      /**
       * Lo de dentro se queda dentro; lo de fuera —un enlace a la web de un
       * cliente, por ejemplo— se abre en el navegador del sistema.
       */
      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (HOST.equals(url.getHost())) return false;
        try {
          startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (Exception ignored) {
          // Sin navegador instalado no hay nada que hacer.
        }
        return true;
      }
    });

    setContentView(web);

    if (saved != null) web.restoreState(saved);
    else web.loadUrl(INICIO);
  }

  /** El botón de atrás navega por el historial de la aplicación, no la cierra. */
  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  @Override
  protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    if (web != null) web.saveState(out);
  }

  @Override
  protected void onDestroy() {
    if (web != null) {
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }
}
