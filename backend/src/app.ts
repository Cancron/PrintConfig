import cors from 'cors';
import express from 'express';
import { categoryRoutes } from './routes/category.routes.js';
import { merchantRoutes } from './routes/merchant.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'product-config-api' }));
app.use('/api/merchants', merchantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use(errorHandler);
