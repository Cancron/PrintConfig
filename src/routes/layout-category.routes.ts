import { Router } from 'express';
import * as controller from '../controllers/layout-category.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const layoutCategoryRoutes = Router();
layoutCategoryRoutes.get('/', requireAuth, controller.list);
layoutCategoryRoutes.post('/import', requireAuth, controller.importConfig);
layoutCategoryRoutes.get('/:id', requireAuth, controller.get);
layoutCategoryRoutes.post('/', requireAuth, controller.create);
layoutCategoryRoutes.put('/:id', requireAuth, controller.update);
layoutCategoryRoutes.delete('/:id', requireAuth, controller.remove);
layoutCategoryRoutes.post('/:id/duplicate', requireAuth, controller.duplicate);
layoutCategoryRoutes.get('/:id/export', requireAuth, controller.exportConfig);
