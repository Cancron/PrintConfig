import { Router } from 'express';
import * as controller from '../controllers/layout-template.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const layoutTemplateRoutes = Router();
layoutTemplateRoutes.get('/', requireAuth, controller.list);
layoutTemplateRoutes.post('/import', requireAuth, controller.importConfig);
layoutTemplateRoutes.get('/:id', requireAuth, controller.get);
layoutTemplateRoutes.post('/', requireAuth, controller.create);
layoutTemplateRoutes.put('/:id', requireAuth, controller.update);
layoutTemplateRoutes.delete('/:id', requireAuth, controller.remove);
layoutTemplateRoutes.post('/:id/duplicate', requireAuth, controller.duplicate);
layoutTemplateRoutes.get('/:id/export', requireAuth, controller.exportConfig);
