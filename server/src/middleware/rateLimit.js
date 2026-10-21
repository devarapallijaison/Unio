import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

/** Per-brand limit for AI brief drafts (each call costs money and takes several seconds). */
export const briefDraftLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Route sits behind requireAuth, so the brand's id is the key; IP is only a safety fallback.
  keyGenerator: (req) => (req.user ? `brief:${req.user._id}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'You’ve generated several drafts in a short time. Wait a few minutes, or use the template.', details: [] },
    }),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes and try again.', details: [] },
    }),
});

/** Project messages: 30 per minute per user (F6). */
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `msg:${req.user._id}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'You’re sending messages very quickly. Wait a moment and try again.', details: [] },
    }),
});

/** Public approval links: per-IP, since the client has no account. */
export const approvalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a few minutes and try again.', details: [] },
    }),
});

/** Upload URLs: 30 per 10 minutes per user (guide §8). */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `upload:${req.user._id}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'You have started many uploads in a short time. Wait a few minutes and try again.', details: [] },
    }),
});

/** Trust submissions make the server fetch the creator's links (pre-checks): 30 per hour per creator. */
export const verifySubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.isTest ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `verify:${req.user._id}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'You have submitted several times in a short while. Try again later.', details: [] },
    }),
});
