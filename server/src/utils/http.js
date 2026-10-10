export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function paginate({ page = 1, limit = 12 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function pageResult(items, total, { page, limit }) {
  return { items, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive exact match for array-of-string fields (skills, tools, ...). */
export function ciExact(value) {
  return new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
}
