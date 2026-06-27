import { Router } from 'express';
import * as controller from '../controllers/image-folder.controller.js';

export const imageFolderRoutes = Router();
imageFolderRoutes.get('/', controller.list);
imageFolderRoutes.get('/all', controller.listAll);
imageFolderRoutes.get('/:id', controller.get);
imageFolderRoutes.post('/', controller.create);
imageFolderRoutes.put('/:id', controller.update);
imageFolderRoutes.delete('/:id', controller.remove);