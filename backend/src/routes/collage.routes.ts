import { Router } from 'express';
import * as controller from '../controllers/collage.controller.js';

export const collageRoutes = Router();
collageRoutes.get('/', controller.list);
collageRoutes.post('/import', controller.importConfig);
collageRoutes.get('/:id', controller.get);
collageRoutes.post('/', controller.create);
collageRoutes.put('/:id', controller.update);
collageRoutes.delete('/:id', controller.remove);
collageRoutes.post('/:id/duplicate', controller.duplicate);
collageRoutes.get('/:id/export', controller.exportConfig);