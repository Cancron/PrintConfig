import { Router } from 'express';
import * as controller from '../controllers/product.controller.js';

export const productRoutes = Router();
productRoutes.get('/', controller.list);
productRoutes.get('/:id', controller.get);
productRoutes.post('/', controller.create);
productRoutes.put('/:id', controller.update);
productRoutes.delete('/:id', controller.remove);
productRoutes.post('/:id/duplicate', controller.duplicate);
productRoutes.get('/:id/export', controller.exportConfig);
productRoutes.post('/import', controller.importConfig);
productRoutes.post('/:id/calculate-price', controller.calculatePrice);
