/** @type {import('next').NextConfig} */
const nextConfig = {
  // Servimos public/index.html en la raíz "/", sin convertir el HTML a React.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};

export default nextConfig;
