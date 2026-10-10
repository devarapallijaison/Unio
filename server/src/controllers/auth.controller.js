import { clearSessionCookie, setSessionCookie } from '../middleware/auth.js';
import * as auth from '../services/auth.service.js';
import { publicUser } from '../services/serializers.js';
import { ok } from '../utils/http.js';

export async function register(req, res) {
  const result = await auth.register(req.valid.body);
  setSessionCookie(res, result.user);
  ok(res, result, 201);
}

export async function login(req, res) {
  const result = await auth.login(req.valid.body);
  setSessionCookie(res, result.user);
  ok(res, result);
}

export function logout(_req, res) {
  clearSessionCookie(res);
  ok(res, { loggedOut: true });
}

export async function me(req, res) {
  ok(res, { user: publicUser(req.user), profile: await auth.getProfileForUser(req.user) });
}
