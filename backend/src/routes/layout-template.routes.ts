import { Router } from 'express';
import * as controller from '../controllers/layout-template.controller.js';

export const layoutTemplateRoutes = Router();
layoutTemplateRoutes.get('/', controller.list);
layoutTemplateRoutes.post('/import', controller.importConfig);
layoutTemplateRoutes.get('/:id', controller.get);
layoutTemplateRoutes.post('/', controller.create);
layoutTemplateRoutes.put('/:id', controller.update);
layoutTemplateRoutes.delete('/:id', controller.remove);
layoutTemplateRoutes.post('/:id/duplicate', controller.duplicate);
layoutTemplateRoutes.get('/:id/export', controller.exportConfig);