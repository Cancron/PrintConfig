import { build, loadEnv } from 'vite';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const backendRoot = fileURLToPath(new URL('../backend/', import.meta.url));
const adminOutput = fileURLToPath(new URL('../backend/public/admin/', import.meta.url));

process.chdir(projectRoot);
const backendEnv = loadEnv('production', backendRoot, 'API_BASE_PATH');
const configuredPrefix = String(backendEnv.API_BASE_PATH ?? '').trim().replace(/^\/+|\/+$/g, '');
const prefix = configuredPrefix ? `/${configuredPrefix}` : '';
const adminBase = `${prefix}/admin/`;
process.env.VITE_BASE_PATH = `${prefix}/admin`;
process.env.VITE_API_URL = `${prefix}/api`;

await build({
  base: adminBase,
  experimental: {
    renderBuiltUrl(filename) {
      return `${adminBase}_assets/${Buffer.from(filename).toString('hex')}`;
    },
  },
  build: { outDir: adminOutput, emptyOutDir: true },
});

const compiler = fileURLToPath(new URL('../backend/node_modules/typescript/bin/tsc', import.meta.url));
const result = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.json'], {
  cwd: backendRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Deployment ready: upload backend/ with dist/ and public/admin/. Admin: ${adminBase}; API: ${prefix}/api`);
