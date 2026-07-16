import type { Request, Response } from 'express';
import { ApiError } from '../middleware/errorHandler.js';
import { signIn, signUp, getUserById } from '../services/auth.service.js';
import type { AuthedRequest } from '../middleware/auth.js';

export async function signUpController(req: Request, res: Response) {
  const { email, password, name } = req.body ?? {};
  const { user, token } = await signUp(email, password, name);
  res.status(201).json({ user, token });
}

export async function signInController(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  const { user, token } = await signIn(email, password);
  res.json({ user, token });
}

export async function meController(req: AuthedRequest, res: Response) {
  if (!req.user?._id) throw new ApiError(401, 'Authentication required.');
  const user = await getUserById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found.');
  res.json({ user });
}
