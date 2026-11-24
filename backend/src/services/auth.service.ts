import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured.');
  return secret;
}
const JWT_EXPIRES_IN = '7d';
const DOWNLOAD_TOKEN_EXPIRES_IN = '5m';

export interface AuthUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  accountId?: string;
}

export function signToken(user: { _id: string; email: string; name: string; role: string; accountId?: string }): string {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name, role: user.role, accountId: user.accountId ? String(user.accountId) : undefined },
    jwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
}

export function signDownloadToken(input: { sub: string; accountId?: string; cartItemId: string; scope: 'final-prints-download' }): string {
  return jwt.sign(
    { sub: input.sub, accountId: input.accountId, cartItemId: input.cartItemId, scope: input.scope },
    jwtSecret(),
    { expiresIn: DOWNLOAD_TOKEN_EXPIRES_IN }
  );
}

export function verifyDownloadToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
}

export async function signUp(email: string, password: string, name: string): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new ApiError(400, 'A valid email is required.');
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters.');
  }
  if (!name.trim()) {
    throw new ApiError(400, 'Name is required.');
  }

  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({ email: normalizedEmail, passwordHash, name: name.trim() });
  const authUser: AuthUser = {
    _id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    accountId: user.accountId ? String(user.accountId) : undefined,
  };
  const token = signToken(authUser);
  return { user: authUser, token };
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new ApiError(400, 'Email is required.');
  if (!password) throw new ApiError(400, 'Password is required.');

  const user = await UserModel.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const authUser: AuthUser = {
    _id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    accountId: user.accountId ? String(user.accountId) : undefined,
  };
  const token = signToken(authUser);
  return { user: authUser, token };
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const user = await UserModel.findById(id);
  if (!user) return null;
  return {
    _id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    accountId: user.accountId ? String(user.accountId) : undefined,
  };
}
