/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Caché del router en cliente: volver a una sección ya visitada es
    // instantáneo en lugar de repetir el viaje a Irlanda.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
