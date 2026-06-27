import cors from 'cors';
import express from 'express';
import { categoryRoutes } from './routes/category.routes.js';
import { merchantRoutes } from './routes/merchant.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { imageFolderRoutes } from './routes/image-folder.routes.js';
import { imageAssetRoutes } from './routes/image-asset.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const configuredOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (configuredOrigins.includes(origin)) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const app = express();
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'product-config-api' }));
app.use('/api/merchants', merchantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/image-folders', imageFolderRoutes);
app.use('/api/image-assets', imageAssetRoutes);
app.use(errorHandler);
