import { Router } from 'express';
import * as controller from '../controllers/layout-category.controller.js';

export const layoutCategoryRoutes = Router();
layoutCategoryRoutes.get('/', controller.list);
layoutCategoryRoutes.post('/import', controller.importConfig);
layoutCategoryRoutes.get('/:id', controller.get);
layoutCategoryRoutes.post('/', controller.create);
layoutCategoryRoutes.put('/:id', controller.update);
layoutCategoryRoutes.delete('/:id', controller.remove);
layoutCategoryRoutes.post('/:id/duplicate', controller.duplicate);
layoutCategoryRoutes.get('/:id/export', controller.exportConfig);