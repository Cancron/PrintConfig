import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRoutes = Router();

authRoutes.post('/signup', controller.signUpController);
authRoutes.post('/signin', controller.signInController);
authRoutes.get('/me', requireAuth, controller.meController);
