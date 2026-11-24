import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const frontendEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const backendEnv = loadEnv(mode, '..', 'API_BASE_PATH');
  const configuredPrefix = String(backendEnv.API_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  const prefix = configuredPrefix ? `/${configuredPrefix}` : '';
  const adminBase = `${prefix}/admin/`;
  const configuredFrontendBase = String(frontendEnv.VITE_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
  const devBase = configuredFrontendBase ? `/${configuredFrontendBase}/` : '/';
  if (mode === 'production') {
    process.env.VITE_API_URL = `${prefix}/api`;
    process.env.VITE_BASE_PATH = `${prefix}/admin`;
  } else if (!process.env.VITE_API_URL && !frontendEnv.VITE_API_URL) {
    process.env.VITE_API_URL = `http://localhost:5000${prefix}/api`;
  }
  return {
    base: mode === 'production' ? adminBase : devBase,
    build: { assetsDir: '_assets' },
    experimental: mode === 'production' ? {
      renderBuiltUrl(filename: string) {
        return `${adminBase}_assets/${Buffer.from(filename).toString('hex')}`;
      },
    } : undefined,
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
