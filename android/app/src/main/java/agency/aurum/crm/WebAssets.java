package agency.aurum.crm;

import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Predicate;

/**
 * Sirve la exportación del CRM desde `assets/web/`, en la raíz del dominio.
 *
 * No se usa el `AssetsPathHandler` que trae la librería por dos razones, y las
 * dos rompen la aplicación:
 *
 *  - Monta los ficheros bajo un prefijo (`/assets/…`), pero los enlaces y los
 *    scripts de Next son absolutos (`/contacts/`, `/_next/…`). Servida bajo un
 *    prefijo, la aplicación no encontraría ni su propio JavaScript.
 *  - No resuelve directorios: `/contacts/` tiene que acabar sirviendo
 *    `contacts/index.html`, y él devuelve un 404.
 *
 * Es el mismo criterio que usa la aplicación de escritorio para su protocolo.
 */
class WebAssets implements WebViewAssetLoader.PathHandler {

  /** Carpeta dentro de assets/ donde vive la exportación. */
  private static final String RAIZ = "web";

  private static final Map<String, String> MIME = new HashMap<>();

  static {
    MIME.put("html", "text/html");
    MIME.put("js", "text/javascript");
    MIME.put("mjs", "text/javascript");
    MIME.put("css", "text/css");
    MIME.put("json", "application/json");
    MIME.put("webmanifest", "application/manifest+json");
    MIME.put("txt", "text/plain");
    MIME.put("svg", "image/svg+xml");
    MIME.put("png", "image/png");
    MIME.put("jpg", "image/jpeg");
    MIME.put("jpeg", "image/jpeg");
    MIME.put("gif", "image/gif");
    MIME.put("webp", "image/webp");
    MIME.put("ico", "image/x-icon");
    MIME.put("woff", "font/woff");
    MIME.put("woff2", "font/woff2");
    MIME.put("ttf", "font/ttf");
    MIME.put("map", "application/json");
  }

  private final AssetManager assets;

  WebAssets(AssetManager assets) {
    this.assets = assets;
  }

  @Nullable
  @Override
  public WebResourceResponse handle(@NonNull String path) {
    String limpia = path.startsWith("/") ? path.substring(1) : path;

    // Nadie se sale de la carpeta, ni con ../
    if (limpia.contains("..")) return respuesta404();

    String encontrado = resolver(limpia, this::existe);
    if (encontrado == null) {
      // Una ruta desconocida devuelve igualmente una página de la aplicación:
      // el enrutador del cliente sabe qué hacer con ella.
      encontrado = existe(RAIZ + "/404.html") ? RAIZ + "/404.html" : null;
      if (encontrado == null) return respuesta404();
    }

    try {
      InputStream in = assets.open(encontrado);
      WebResourceResponse res = new WebResourceResponse(mime(encontrado), "utf-8", in);
      Map<String, String> headers = new HashMap<>();
      headers.put("Cache-Control", "no-cache");
      res.setResponseHeaders(headers);
      return res;
    } catch (IOException e) {
      return respuesta404();
    }
  }

  /**
   * `/` y `/contacts/` acaban en index.html; `/_next/x.js` va tal cual.
   *
   * Sin dependencias de Android a propósito: así se puede probar contra la
   * lista real de ficheros del APK sin emulador.
   */
  @Nullable
  static String resolver(String limpia, Predicate<String> existe) {
    String base = RAIZ + "/" + limpia;

    if (limpia.isEmpty() || limpia.endsWith("/")) {
      String indice = base + "index.html";
      return existe.test(indice) ? indice : null;
    }

    if (existe.test(base)) return base;
    if (existe.test(base + ".html")) return base + ".html";
    if (existe.test(base + "/index.html")) return base + "/index.html";
    return null;
  }

  private boolean existe(String ruta) {
    try {
      assets.open(ruta).close();
      return true;
    } catch (IOException e) {
      return false;
    }
  }

  static String mime(String ruta) {
    String ext = "";
    int punto = ruta.lastIndexOf('.');
    int barra = ruta.lastIndexOf('/');
    if (punto > barra) ext = ruta.substring(punto + 1).toLowerCase();
    String tipo = MIME.get(ext);
    return tipo != null ? tipo : "application/octet-stream";
  }

  private static WebResourceResponse respuesta404() {
    return new WebResourceResponse(
        "text/plain",
        "utf-8",
        404,
        "No encontrado",
        new HashMap<String, String>(),
        new ByteArrayInputStream("No encontrado".getBytes()));
  }
}
