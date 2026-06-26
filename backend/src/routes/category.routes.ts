import { Router } from 'express';
import * as controller from '../controllers/category.controller.js';

export const categoryRoutes = Router();
categoryRoutes.get('/', controller.list);
categoryRoutes.get('/:id', controller.get);
categoryRoutes.post('/', controller.create);
categoryRoutes.put('/:id', controller.update);
categoryRoutes.delete('/:id', controller.remove);
categoryRoutes.post('/:id/duplicate', controller.duplicate);
