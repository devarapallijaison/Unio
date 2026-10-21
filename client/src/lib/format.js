const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatINR(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return inr.format(Number(value));
}

export function formatBudget(min, max) {
  if (min == null && max == null) return 'Budget on request';
  if (min != null && max != null) return min === max ? formatINR(min) : `${formatINR(min)}–${formatINR(max)}`;
  return min != null ? `From ${formatINR(min)}` : `Up to ${formatINR(max)}`;
}

export function formatDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', opts);
}

export function relativeDeadline(value) {
  if (!value) return 'No deadline';
  const days = Math.ceil((new Date(value) - Date.now()) / 86_400_000);
  if (days < 0) return `Closed ${formatDate(value, { day: 'numeric', month: 'short' })}`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  if (days <= 60) return `${days} days left`;
  return `Due ${formatDate(value)}`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function pluralize(n, word, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

/** Comma-separated text → trimmed array. */
export function splitTags(text = '') {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Stable small hash for deterministic visuals. */
export function hashString(str = '') {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** "just now", "2 h ago", "yesterday", "3 d ago": for events that happened a short while back. */
export function timeAgo(value) {
  if (!value) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(value)) / 60000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} d ago`;
}
