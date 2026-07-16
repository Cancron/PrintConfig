import { Router } from 'express';
import * as controller from '../controllers/category.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const categoryRoutes = Router();
categoryRoutes.get('/', requireAuth, controller.list);
categoryRoutes.get('/:id', requireAuth, controller.get);
categoryRoutes.post('/', requireAuth, controller.create);
categoryRoutes.put('/:id', requireAuth, controller.update);
categoryRoutes.delete('/:id', requireAuth, controller.remove);
categoryRoutes.post('/:id/duplicate', requireAuth, controller.duplicate);
