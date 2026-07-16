import { Router } from 'express';
import * as controller from '../controllers/image-asset.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const imageAssetRoutes = Router();
imageAssetRoutes.get('/', requireAuth, controller.list);
imageAssetRoutes.get('/:id', requireAuth, controller.get);
imageAssetRoutes.post('/', requireAuth, controller.create);
imageAssetRoutes.put('/:id', requireAuth, controller.update);
imageAssetRoutes.delete('/:id', requireAuth, controller.remove);
imageAssetRoutes.post('/:id/move', requireAuth, controller.move);
