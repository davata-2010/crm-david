/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Aurum ya no se aloja: se instala.
   *
   * `export` produce una carpeta de ficheros estáticos que el instalador de
   * escritorio y el APK llevan dentro. No hay servidor que renderice, así que
   * todas las pantallas piden sus datos a Supabase desde el propio dispositivo.
   */
  output: "export",

  // Cada ruta se emite como carpeta con su index.html, que es lo que saben
  // servir tanto el protocolo local de Electron como el WebView de Android.
  trailingSlash: true,

  // El optimizador de imágenes necesitaba un servidor; aquí no lo hay.
  images: { unoptimized: true },
};

export default nextConfig;
