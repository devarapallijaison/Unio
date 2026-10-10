/** Only internal app paths may be used as post-login destinations (prevents open redirects). */
const ALLOWED = /^\/(creators|campaigns|creator|brand|projects)(\/[A-Za-z0-9/_-]*)?(\?[A-Za-z0-9=&_%-]*)?$/;

export function safeReturnTo(value) {
  if (!value || typeof value !== 'string') return null;
  let path;
  try {
    path = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return ALLOWED.test(path) ? path : null;
}

export function dashboardFor(role) {
  return role === 'brand' ? '/brand/dashboard' : '/creator/dashboard';
}

/** Build a login/register link that preserves the user's intended action. */
export function authLink(kind, returnTo) {
  return `/${kind}?returnTo=${encodeURIComponent(returnTo)}`;
}
