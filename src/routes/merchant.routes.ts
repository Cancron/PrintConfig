import { Router } from 'express';
import * as controller from '../controllers/merchant.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const merchantRoutes = Router();
// Public endpoint
merchantRoutes.get('/public-config', controller.getPublicConfig);
// Admin endpoints
merchantRoutes.get('/', requireAuth, controller.list);
merchantRoutes.get('/:id', requireAuth, controller.get);
merchantRoutes.post('/', requireAuth, controller.create);
merchantRoutes.put('/:id', requireAuth, controller.update);
merchantRoutes.post('/:id/api-key', requireAuth, controller.rotateApiKey);
merchantRoutes.delete('/:id', requireAuth, controller.remove);
