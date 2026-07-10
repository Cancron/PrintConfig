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
import { errorHandler } from './middleware/errorHandler.js';

const allowedOrigins = new Set([
  'https://photo-book-prints.lovable.app',
  'https://photo-book-prints.onrender.com',
]);

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.has(origin.replace(/\/$/, ''))) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
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
app.use('/api/merchants', merchantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/image-folders', imageFolderRoutes);
app.use('/api/image-assets', imageAssetRoutes);
app.use('/api/layout-categories', layoutCategoryRoutes);
app.use('/api/layout-templates', layoutTemplateRoutes);
app.use('/api/collages', collageRoutes);
app.use(errorHandler);
