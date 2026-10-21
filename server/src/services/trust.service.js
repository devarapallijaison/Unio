import { CreatorProfile, Project, VerificationSubmission } from '../models/index.js';

/**
 * UNIO Trust (guide §5.3, F5). The ONLY writer of a creator's denormalised trust fields:
 * verifiedTools, certifiedTools, pendingTools, madeOnUnioCount, ratingAvg/ratingCount, trustLevel.
 * Everything is recomputed from real records (reviewer decisions, completed projects, project feedback)
 * so the numbers can never drift from — or claim more than — what the database shows.
 */

/** 5 = verified tool + made on UNIO · 4 = verified tool · 3 = certified · 2 = anything pending · 1 = self-reported. */
export function trustLevelFor({ verifiedTools, certifiedTools, madeOnUnioCount, hasPending }) {
  if (verifiedTools.length && madeOnUnioCount > 0) return 5;
  if (verifiedTools.length) return 4;
  if (certifiedTools.length) return 3;
  if (hasPending) return 2;
  return 1;
}

const unique = (list) => [...new Set(list)];

/** A reviewer approval lasts 12 months (guide F5). Claims approved before expiry existed have no expiresAt and never lapse. */
export const isExpired = (claim, now = new Date()) => claim.status === 'VERIFIED' && !!claim.expiresAt && new Date(claim.expiresAt) < now;
export const EXPIRY_WARNING_DAYS = 30;

export async function computeCreatorTrust(creatorId) {
  const [claims, completed] = await Promise.all([
    VerificationSubmission.find({ creatorId }, 'type subject status expiresAt').lean(),
    Project.find({ creatorId, status: 'completed' }, 'feedback.rating').lean(),
  ]);
  const now = new Date();
  // An expired approval counts as self-reported everywhere (profile, Discover, matching).
  const tools = (status) => unique(claims.filter((c) => c.type === 'tool' && c.status === status && !isExpired(c, now)).map((c) => c.subject));
  const certifiedTools = unique(claims.filter((c) => c.type === 'certificate' && c.status === 'VERIFIED' && !isExpired(c, now)).map((c) => c.subject));
  const ratings = completed.map((p) => p.feedback?.rating).filter((r) => typeof r === 'number');

  const trust = {
    verifiedTools: tools('VERIFIED'),
    certifiedTools,
    pendingTools: tools('PENDING'),
    madeOnUnioCount: completed.length,
    ratingCount: ratings.length,
    ratingAvg: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
  };
  trust.trustLevel = trustLevelFor({ ...trust, hasPending: claims.some((c) => c.status === 'PENDING') });
  return trust;
}

/** Recompute and store. Call after any change to claims, project completion or feedback. */
export async function recomputeCreatorTrust(creatorId) {
  if (!creatorId) return null;
  const trust = await computeCreatorTrust(creatorId);
  await CreatorProfile.updateOne({ _id: creatorId }, { $set: trust });
  return trust;
}

/** Cheap read-time check: if a creator has an approval that lapsed since the last recompute, recompute now. */
export async function refreshExpiredTrust(creatorId) {
  const lapsed = await VerificationSubmission.exists({ creatorId, status: 'VERIFIED', expiresAt: { $lt: new Date() } });
  if (!lapsed) return false;
  const profile = await CreatorProfile.findById(creatorId, 'verifiedTools certifiedTools').lean();
  const lapsedClaims = await VerificationSubmission.find({ creatorId, status: 'VERIFIED', expiresAt: { $lt: new Date() } }, 'type subject').lean();
  const stale = lapsedClaims.some((c) => (c.type === 'tool' ? profile?.verifiedTools : profile?.certifiedTools)?.includes(c.subject));
  if (stale) await recomputeCreatorTrust(creatorId);
  return stale;
}

/** Recompute every creator whose approval has lapsed. Run at start-up and hourly (server.js). */
export async function sweepExpiredTrust() {
  const ids = await VerificationSubmission.distinct('creatorId', { status: 'VERIFIED', expiresAt: { $lt: new Date() } });
  let changed = 0;
  for (const id of ids) if (await refreshExpiredTrust(id)) changed += 1;
  return changed;
}
