import mongoose from 'mongoose';

/** Map documents of `Model` by a key field (default `_id`). */
export async function mapBy(Model, ids, { key = '_id', projection } = {}) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const docs = await Model.find({ [key]: { $in: unique } }, projection).lean();
  return new Map(docs.map((d) => [String(d[key]), d]));
}

const NO_TXN = /Transaction numbers are only allowed|replica set|IllegalOperation|does not support transactions/i;

/**
 * Runs `fn(session)` in a transaction when the deployment supports it (Atlas does).
 * Falls back to running without a session on standalone servers; callers keep their
 * operations idempotent (conditional updates + unique indexes) so this stays safe.
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (NO_TXN.test(err?.message || '')) return fn(null);
    throw err;
  } finally {
    await session.endSession();
  }
}
