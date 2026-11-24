import { Router } from 'express';
import * as controller from '../controllers/image-folder.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const imageFolderRoutes = Router();
imageFolderRoutes.get('/', requireAuth, controller.list);
imageFolderRoutes.get('/all', requireAuth, controller.listAll);
imageFolderRoutes.get('/:id', requireAuth, controller.get);
imageFolderRoutes.post('/', requireAuth, controller.create);
imageFolderRoutes.put('/:id', requireAuth, controller.update);
imageFolderRoutes.delete('/:id', requireAuth, controller.remove);
