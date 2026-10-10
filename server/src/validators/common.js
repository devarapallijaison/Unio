import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });

export const httpUrl = z.url({ protocol: /^https?$/, message: 'Must be a valid http(s) URL' }).max(2048);
/** Optional URL that may be cleared with an empty string. */
export const optionalUrl = z.union([z.literal(''), httpUrl]).optional();

export const text = (max, min = 0) => z.string().trim().min(min).max(max);

/** Short tag list (skills, tools...). Deduplicated case-insensitively, empty entries removed. */
export const tagList = z
  .array(z.string().trim().max(60))
  .max(30)
  .transform((list) => {
    const seen = new Set();
    return list.filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

export const money = z.coerce.number().min(0).max(100_000_000);

export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};

/** Optional query string param: empty strings are treated as absent. */
export const qText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || undefined);

export const qNumber = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(0).optional());
