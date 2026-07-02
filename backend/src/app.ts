import cors from 'cors';
import express from 'express';
import { categoryRoutes } from './routes/category.routes.js';
import { merchantRoutes } from './routes/merchant.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { imageFolderRoutes } from './routes/image-folder.routes.js';
import { imageAssetRoutes } from './routes/image-asset.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const corsOptions: cors.CorsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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
