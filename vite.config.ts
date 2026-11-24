import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const basePath = (env.VITE_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  return {
  base: basePath ? `/${basePath}/` : '/',
  build: { assetsDir: '_assets' },
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  };
});
