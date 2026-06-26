import { Router } from 'express';
import * as controller from '../controllers/merchant.controller.js';

export const merchantRoutes = Router();
merchantRoutes.get('/', controller.list);
merchantRoutes.get('/:id', controller.get);
merchantRoutes.post('/', controller.create);
merchantRoutes.put('/:id', controller.update);
merchantRoutes.delete('/:id', controller.remove);
