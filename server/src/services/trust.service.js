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

export async function computeCreatorTrust(creatorId) {
  const [claims, completed] = await Promise.all([
    VerificationSubmission.find({ creatorId }, 'type subject status').lean(),
    Project.find({ creatorId, status: 'completed' }, 'feedback.rating').lean(),
  ]);
  const tools = (status) => unique(claims.filter((c) => c.type === 'tool' && c.status === status).map((c) => c.subject));
  // Certificates arrive with Phase 8 (type 'certificate'); until then nothing is certified.
  const certifiedTools = unique(claims.filter((c) => c.type === 'certificate' && c.status === 'VERIFIED').map((c) => c.subject));
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
