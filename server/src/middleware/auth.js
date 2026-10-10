import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    // Frontend and API live on different domains in production, which requires SameSite=None.
    sameSite: env.isProd ? 'none' : 'lax',
    path: '/',
  };
}

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: '7d' });
  res.cookie(env.cookieName, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, cookieOptions());
}

async function resolveUser(req) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    // Role is always read from the database, never trusted from the token alone.
    return await User.findById(payload.sub).lean();
  } catch {
    return null;
  }
}

export async function requireAuth(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthenticated();
  req.user = user;
  next();
}

export async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) throw ApiError.unauthenticated();
    if (req.user.role !== role) {
      throw ApiError.forbidden(`This action is only available to ${role} accounts`);
    }
    next();
  };
}
