import { Router } from 'express';
import * as controller from '../controllers/collage.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const collageRoutes = Router();
collageRoutes.get('/', requireAuth, controller.list);
collageRoutes.post('/import', requireAuth, controller.importConfig);
collageRoutes.get('/:id', requireAuth, controller.get);
collageRoutes.post('/', requireAuth, controller.create);
collageRoutes.put('/:id', requireAuth, controller.update);
collageRoutes.delete('/:id', requireAuth, controller.remove);
collageRoutes.post('/:id/duplicate', requireAuth, controller.duplicate);
collageRoutes.get('/:id/export', requireAuth, controller.exportConfig);
