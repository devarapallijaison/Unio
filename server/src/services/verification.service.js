import { BrandProfile, Campaign, CreatorProfile, PortfolioItem, Project, VerificationSubmission } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { pageResult, paginate } from '../utils/http.js';
import { requireCreatorProfile } from './profile.service.js';
import { creatorSummary } from './serializers.js';
import { recomputeCreatorTrust } from './trust.service.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const slug = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');

function keyFor(type, { subject, portfolioItemId }) {
  return type === 'portfolio' ? `portfolio:${portfolioItemId}` : `${type}:${slug(subject)}`;
}

/** Creator-editable states. VERIFIED is locked so evidence can't be swapped after approval. */
const CREATOR_EDITABLE = ['SELF_REPORTED', 'PENDING', 'REJECTED'];

/**
 * The only statuses a creator action can produce. VERIFIED/REJECTED are reviewer-only and
 * are never accepted from creator input (the validator does not even allow a status field).
 */
function creatorStatus(submit, evidenceUrls) {
  if (!submit) return 'SELF_REPORTED';
  if (!evidenceUrls?.length) {
    throw ApiError.badRequest('Add at least one evidence link before submitting for review', [
      { location: 'body', field: 'evidenceUrls', message: 'At least one evidence link is required to submit' },
    ]);
  }
  return 'PENDING';
}

async function resolvePortfolioSubject(profile, portfolioItemId) {
  const item = await PortfolioItem.findOne({ _id: portfolioItemId, creatorId: profile._id }, 'title').lean();
  if (!item) throw ApiError.notFound('Portfolio item not found');
  return item.title;
}

/* ------------------------------------------------------------------ */
/* Creator                                                             */
/* ------------------------------------------------------------------ */

export async function listOwn(user) {
  const profile = await requireCreatorProfile(user);
  const items = await VerificationSubmission.find({ creatorId: profile._id }).sort({ type: 1, updatedAt: -1 }).lean();
  // reviewerId is internal; creators see the decision and note only.
  return items.map(({ reviewerId: _r, ...rest }) => rest);
}

export async function create(user, { type, subject, portfolioItemId, description, evidenceUrls = [], submit }) {
  const profile = await requireCreatorProfile(user);
  if (type === 'portfolio') {
    if (!portfolioItemId) throw ApiError.badRequest('Choose a portfolio piece', [{ location: 'body', field: 'portfolioItemId', message: 'Required' }]);
    subject = await resolvePortfolioSubject(profile, portfolioItemId);
  }
  const status = creatorStatus(submit, evidenceUrls);
  const key = keyFor(type, { subject, portfolioItemId });

  if (await VerificationSubmission.exists({ creatorId: profile._id, key })) {
    throw ApiError.conflict('You already have a verification entry for this. Edit it instead.', 'ALREADY_EXISTS');
  }
  try {
    const doc = await VerificationSubmission.create({
      creatorId: profile._id,
      type,
      key,
      subject,
      portfolioItemId: type === 'portfolio' ? portfolioItemId : undefined,
      description: description ?? '',
      evidenceUrls,
      status,
      submittedAt: status === 'PENDING' ? new Date() : undefined,
    });
    await recomputeCreatorTrust(profile._id);
    const { reviewerId: _r, ...rest } = doc.toObject();
    return rest;
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('You already have a verification entry for this. Edit it instead.', 'ALREADY_EXISTS');
    throw err;
  }
}

export async function update(user, id, { subject, description, evidenceUrls, submit }) {
  const profile = await requireCreatorProfile(user);
  const doc = await VerificationSubmission.findOne({ _id: id, creatorId: profile._id });
  if (!doc) throw ApiError.notFound('Verification entry not found');
  if (!CREATOR_EDITABLE.includes(doc.status)) {
    throw ApiError.conflict('Verified entries are locked. Withdraw it and create a new one to change the evidence.', 'LOCKED');
  }

  if (subject !== undefined && doc.type !== 'portfolio') {
    doc.subject = subject;
    doc.key = keyFor(doc.type, { subject });
  }
  if (description !== undefined) doc.description = description;
  if (evidenceUrls !== undefined) doc.evidenceUrls = evidenceUrls;

  const status = creatorStatus(submit, doc.evidenceUrls);
  doc.status = status;
  doc.submittedAt = status === 'PENDING' ? new Date() : undefined;
  // Any creator edit starts a fresh review cycle.
  doc.reviewerId = undefined;
  doc.reviewNote = '';
  doc.reviewedAt = undefined;

  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict('Another entry already covers this tool or workflow', 'ALREADY_EXISTS');
    throw err;
  }
  await recomputeCreatorTrust(profile._id);
  const { reviewerId: _r, ...rest } = doc.toObject();
  return rest;
}

export async function remove(user, id) {
  const profile = await requireCreatorProfile(user);
  const res = await VerificationSubmission.deleteOne({ _id: id, creatorId: profile._id });
  if (!res.deletedCount) throw ApiError.notFound('Verification entry not found');
  await recomputeCreatorTrust(profile._id);
  return { deleted: true };
}

/** Called when a portfolio item's media changes: earlier approval no longer covers the new file. */
export async function invalidatePortfolioEvidence(creatorId, portfolioItemId) {
  await VerificationSubmission.updateOne(
    { creatorId, key: `portfolio:${portfolioItemId}`, status: { $in: ['VERIFIED', 'PENDING'] } },
    {
      $set: { status: 'PENDING', submittedAt: new Date(), reviewNote: 'Portfolio media changed — awaiting re-review.' },
      $unset: { reviewerId: 1, reviewedAt: 1 },
    },
  );
  await recomputeCreatorTrust(creatorId);
}

/* ------------------------------------------------------------------ */
/* Reviewer                                                            */
/* ------------------------------------------------------------------ */

async function hydrateForReview(docs) {
  const [creators, items] = await Promise.all([
    mapBy(CreatorProfile, docs.map((d) => d.creatorId)),
    mapBy(PortfolioItem, docs.map((d) => d.portfolioItemId)),
  ]);
  return docs.map((d) => ({
    ...d,
    creator: creatorSummary(creators.get(String(d.creatorId))),
    portfolioItem: d.portfolioItemId ? items.get(String(d.portfolioItemId)) ?? null : null,
  }));
}

export async function listForReview(q) {
  const filter = { status: q.status ?? 'PENDING' };
  if (q.type) filter.type = q.type;
  const pg = paginate(q);
  const sort = filter.status === 'PENDING' ? { submittedAt: 1 } : { reviewedAt: -1 };
  const [docs, total] = await Promise.all([
    VerificationSubmission.find(filter).sort(sort).skip(pg.skip).limit(pg.limit).lean(),
    VerificationSubmission.countDocuments(filter),
  ]);
  const counts = await VerificationSubmission.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  return { ...pageResult(await hydrateForReview(docs), total, pg), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) };
}

export async function decide(reviewer, id, { decision, note }) {
  // Conditional update: only PENDING submissions can be decided, and only once.
  const doc = await VerificationSubmission.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: decision, reviewNote: note ?? '', reviewerId: reviewer._id, reviewedAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();
  if (!doc) {
    const exists = await VerificationSubmission.findById(id, 'status').lean();
    if (!exists) throw ApiError.notFound('Submission not found');
    throw ApiError.invalidTransition(exists.status, decision);
  }
  await recomputeCreatorTrust(doc.creatorId);
  const [hydrated] = await hydrateForReview([doc]);
  return hydrated;
}

/* ------------------------------------------------------------------ */
/* Public signals                                                      */
/* ------------------------------------------------------------------ */

/** What visitors may see. REJECTED is shown as SELF_REPORTED: the claim stands unverified. */
const publicStatus = (s) => (s === 'REJECTED' ? 'SELF_REPORTED' : s);

export async function publicSignals(profile) {
  const [docs, completedProjects, feedbackProjects] = await Promise.all([
    VerificationSubmission.find({ creatorId: profile._id }, 'type subject portfolioItemId description status reviewedAt').lean(),
    Project.countDocuments({ creatorId: profile._id, status: 'completed' }),
    Project.find({ creatorId: profile._id, status: 'completed', 'feedback.rating': { $exists: true } }, 'feedback brandId campaignId')
      .sort({ 'feedback.createdAt': -1 })
      .limit(10)
      .lean(),
  ]);

  const toolSignals = new Map(docs.filter((d) => d.type === 'tool').map((d) => [slug(d.subject), d]));
  const tools = [...new Set([...(profile.tools ?? []), ...[...toolSignals.values()].map((d) => d.subject)])].map((name) => {
    const sig = toolSignals.get(slug(name));
    const status = sig ? publicStatus(sig.status) : 'SELF_REPORTED';
    return { name, status, reviewedAt: status === 'VERIFIED' ? sig.reviewedAt : undefined };
  });

  const workflows = docs
    .filter((d) => d.type === 'workflow' && ['VERIFIED', 'PENDING'].includes(d.status))
    .map((d) => ({ subject: d.subject, description: d.description, status: d.status }));

  const portfolio = Object.fromEntries(
    docs.filter((d) => d.type === 'portfolio').map((d) => [String(d.portfolioItemId), publicStatus(d.status)]),
  );

  const [brands, campaigns] = await Promise.all([
    mapBy(BrandProfile, feedbackProjects.map((p) => p.brandId), { key: 'userId', projection: 'companyName userId' }),
    mapBy(Campaign, feedbackProjects.map((p) => p.campaignId), { projection: 'title' }),
  ]);
  const feedback = feedbackProjects.map((p) => ({
    rating: p.feedback.rating,
    comment: p.feedback.comment,
    createdAt: p.feedback.createdAt,
    brandName: brands.get(String(p.brandId))?.companyName ?? 'Brand',
    campaignTitle: campaigns.get(String(p.campaignId))?.title ?? '',
  }));

  return {
    tools,
    workflows,
    portfolio,
    verifiedCount: docs.filter((d) => d.status === 'VERIFIED').length,
    completedProjects,
    feedback,
  };
}

/** Verified-signal and completed-project counts for many creators (directory cards). */
export async function signalCounts(creatorIds) {
  const [verified, completed] = await Promise.all([
    VerificationSubmission.aggregate([
      { $match: { creatorId: { $in: creatorIds }, status: 'VERIFIED' } },
      { $group: { _id: '$creatorId', n: { $sum: 1 } } },
    ]),
    Project.aggregate([
      { $match: { creatorId: { $in: creatorIds }, status: 'completed' } },
      { $group: { _id: '$creatorId', n: { $sum: 1 } } },
    ]),
  ]);
  const v = new Map(verified.map((r) => [String(r._id), r.n]));
  const c = new Map(completed.map((r) => [String(r._id), r.n]));
  return (id) => ({ verifiedCount: v.get(String(id)) ?? 0, completedProjects: c.get(String(id)) ?? 0 });
}
