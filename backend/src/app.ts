import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryRoutes } from './routes/category.routes.js';
import { merchantRoutes } from './routes/merchant.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { imageFolderRoutes } from './routes/image-folder.routes.js';
import { imageAssetRoutes } from './routes/image-asset.routes.js';
import { layoutCategoryRoutes } from './routes/layout-category.routes.js';
import { layoutTemplateRoutes } from './routes/layout-template.routes.js';
import { collageRoutes } from './routes/collage.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiBasePath } from './config/api.js';

const configuredOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);

function normalizeHostname(value: string) {
  return value.toLowerCase().replace(/^www\./, '');
}

function isAllowedOrigin(origin: string) {
  const normalizedOrigin = origin.replace(/\/$/, '');
  if (allowedOrigins.has(normalizedOrigin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) return true;
  let originHost = '';
  try {
    originHost = normalizeHostname(new URL(normalizedOrigin).hostname);
  } catch {
    return false;
  }
  for (const allowedOrigin of allowedOrigins) {
    let allowedHost = '';
    try {
      allowedHost = normalizeHostname(new URL(allowedOrigin).hostname);
    } catch {
      continue;
    }
    if (originHost === allowedHost || originHost.endsWith(`.${allowedHost}`)) return true;
  }
  return false;
}

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept', 'X-Requested-With'],
};

export const app = express();
if (apiBasePath) {
  app.use((req, _res, next) => {
    if (req.url === apiBasePath || req.url.startsWith(`${apiBasePath}/`) || req.url.startsWith(`${apiBasePath}?`)) {
      req.url = req.url.slice(apiBasePath.length) || '/';
      if (req.url.startsWith('?')) req.url = `/${req.url}`;
    }
    next();
  });
}
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'product-config-api' }));

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin routes - each router applies requireAuth to protected endpoints internally
app.use('/api/merchants', merchantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/image-folders', imageFolderRoutes);
app.use('/api/image-assets', imageAssetRoutes);
app.use('/api/layout-categories', layoutCategoryRoutes);
app.use('/api/layout-templates', layoutTemplateRoutes);
app.use('/api/collages', collageRoutes);

const adminDirectory = process.env.ADMIN_STATIC_DIR
  ? path.resolve(process.env.ADMIN_STATIC_DIR)
  : fileURLToPath(new URL('../public/admin/', import.meta.url));

// Some shared hosts intercept URLs with file extensions before reaching Node.
app.get('/admin/_assets/:assetKey', (req, res, next) => {
  const key = String(req.params.assetKey);
  if (!/^(?:[a-f0-9]{2})+$/i.test(key) || key.length > 2048) {
    res.sendStatus(404);
    return;
  }
  const filename = Buffer.from(key, 'hex').toString('utf8');
  const allowedAsset = filename.startsWith('_assets/') || filename.startsWith('assets/') || filename === 'printconfig.svg' || filename === 'site.webmanifest';
  if (!allowedAsset || filename.includes('..') || filename.includes('\\') || filename.includes('\0')) {
    res.sendStatus(404);
    return;
  }
  res.sendFile(filename, { root: adminDirectory }, (error) => {
    if (error && !res.headersSent) next(error);
  });
});
app.use('/admin', express.static(adminDirectory, { index: false }));
app.get(['/admin', '/admin/*'], (req, res, next) => {
  // Missing assets must return 404 instead of the SPA HTML document.
  if (path.extname(req.path)) { next(); return; }
  res.sendFile(path.join(adminDirectory, 'index.html'), (error) => {
    if (error && !res.headersSent) next(error);
  });
});
app.use(errorHandler);
