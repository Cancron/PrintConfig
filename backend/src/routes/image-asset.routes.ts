import { Router } from 'express';
import * as controller from '../controllers/image-asset.controller.js';

export const imageAssetRoutes = Router();
imageAssetRoutes.get('/', controller.list);
imageAssetRoutes.get('/:id', controller.get);
imageAssetRoutes.post('/', controller.create);
imageAssetRoutes.put('/:id', controller.update);
imageAssetRoutes.delete('/:id', controller.remove);
imageAssetRoutes.post('/:id/move', controller.move);