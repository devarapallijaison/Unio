import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and strips unknown keys from body/query/params using Zod schemas.
 * Parsed values are placed on req.valid (Express 5 makes req.query read-only).
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    const details = [];
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        req.valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ location: part, field: issue.path.join('.'), message: issue.message });
        }
      }
    }
    if (details.length) throw ApiError.badRequest('Please correct the highlighted fields', details);
    next();
  };
}
