import cors from 'cors';
import express from 'express';
import path from 'node:path';
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

const allowedOrigins = new Set([
  'https://photo-book-prints.lovable.app',
  'https://canadaprintstudio-admin.onrender.com',
  'https://photo-book-studio.onrender.com',
  'https://canvasprintscanada.com',
  'https://www.canvasprintsvancouver.com',
  'https://www.canadaprintstudio.com',
  'https://www.metalprintscanada.com',
]);

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
    const allowedHost = normalizeHostname(new URL(allowedOrigin).hostname);
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
app.use(errorHandler);
