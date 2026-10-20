import { Campaign, CreatorProfile, Invitation, PortfolioItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { ciExact, escapeRegex, pageResult, paginate } from '../utils/http.js';
import { creatorSummary, publicCreator, trustFields } from './serializers.js';
import { publicSignals, signalCounts } from './verification.service.js';

const SORTS = {
  featured: { featured: -1, updatedAt: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  price_asc: { startingPrice: 1, _id: 1 },
  price_desc: { startingPrice: -1, _id: 1 },
};

/** Public piece fields. contentHash (duplicate check) stays internal. */
const PORTFOLIO_PUBLIC = '-contentHash -updatedAt';

/** Featured first, then pieces that show how they were made (guide §5.5), then newest. */
const byRank = (a, b) =>
  Number(!!b.featured) - Number(!!a.featured) ||
  Number((b.workflow?.length ?? 0) > 0) - Number((a.workflow?.length ?? 0) > 0) ||
  new Date(b.createdAt) - new Date(a.createdAt);

/** skill id → number of portfolio pieces that list it, per creator. A skill is "backed" at ≥ 1. */
export async function skillCountsFor(creatorIds) {
  const rows = await PortfolioItem.aggregate([
    { $match: { creatorId: { $in: creatorIds } } },
    { $unwind: '$skills' },
    { $group: { _id: { c: '$creatorId', s: '$skills' }, n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const { _id, n } of rows) {
    const key = String(_id.c);
    map.set(key, { ...(map.get(key) ?? {}), [_id.s]: n });
  }
  return (id) => map.get(String(id)) ?? {};
}

export async function listCreators(q) {
  const filter = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ displayName: rx }, { headline: rx }, { bio: rx }, { skills: rx }, { tools: rx }, { specialties: rx }, { location: rx }];
  }
  if (q.skill) filter.skills = ciExact(q.skill);
  if (q.tool) filter.tools = ciExact(q.tool);
  if (q.specialty) filter.$and = [{ $or: [{ specializations: q.specialty }, { specialties: ciExact(q.specialty) }] }];
  if (q.availability) filter.availability = q.availability;
  if (q.minPrice != null || q.maxPrice != null) {
    filter.startingPrice = {};
    if (q.minPrice != null) filter.startingPrice.$gte = q.minPrice;
    if (q.maxPrice != null) filter.startingPrice.$lte = q.maxPrice;
  }

  const pg = paginate(q);
  const [docs, total] = await Promise.all([
    CreatorProfile.find(filter).sort(SORTS[q.sort] ?? SORTS.featured).skip(pg.skip).limit(pg.limit).lean(),
    CreatorProfile.countDocuments(filter),
  ]);
  const ids = docs.map((d) => d._id);

  // Up to three portfolio previews per creator in a single query.
  const items = (await PortfolioItem.find({ creatorId: { $in: ids } }, PORTFOLIO_PUBLIC).lean()).sort(byRank);
  const previews = new Map();
  for (const item of items) {
    const key = String(item.creatorId);
    const list = previews.get(key) ?? [];
    if (list.length < 3) list.push(item);
    previews.set(key, list);
  }

  const [countsFor, skillsFor] = await Promise.all([signalCounts(ids), skillCountsFor(ids)]);
  return pageResult(
    docs.map((d) => ({ ...publicCreator(d, skillsFor(d._id)), ...countsFor(d._id), portfolioPreview: previews.get(String(d._id)) ?? [] })),
    total,
    pg,
  );
}

export async function getCreator(id, viewer) {
  const profile = await CreatorProfile.findById(id).lean();
  if (!profile) throw ApiError.notFound('Creator not found');

  const [portfolio, skillsFor] = await Promise.all([
    PortfolioItem.find({ creatorId: profile._id }, PORTFOLIO_PUBLIC).lean(),
    skillCountsFor([profile._id]),
  ]);
  portfolio.sort(byRank);

  const result = {
    creator: publicCreator(profile, skillsFor(profile._id)),
    portfolio,
    signals: await publicSignals(profile),
    viewer: null,
  };

  if (viewer?.role === 'brand') {
    const invitations = await Invitation.find({ brandId: viewer._id, creatorId: profile._id }, 'campaignId status').lean();
    const campaigns = await mapBy(Campaign, invitations.map((i) => i.campaignId), { projection: 'title' });
    result.viewer = {
      invitations: invitations.map((i) => ({ ...i, campaignTitle: campaigns.get(String(i.campaignId))?.title ?? 'Campaign' })),
    };
  } else if (viewer?.role === 'creator') {
    result.viewer = { isSelf: String(profile.userId) === String(viewer._id) };
  }
  return result;
}

const sameTool = (a, b) => a.toLowerCase().trim() === b.toLowerCase().trim();

/**
 * One public portfolio piece (P3W) with its creator. Each workflow step is marked verified only when the
 * creator holds a reviewer-verified claim for that tool — the client never decides this.
 */
export async function getPortfolioPiece(itemId) {
  const piece = await PortfolioItem.findById(itemId, PORTFOLIO_PUBLIC).lean();
  if (!piece) throw ApiError.notFound('Portfolio piece not found');
  const profile = await CreatorProfile.findById(piece.creatorId).lean();
  if (!profile) throw ApiError.notFound('Portfolio piece not found');

  const verified = profile.verifiedTools ?? [];
  const workflow = (piece.workflow ?? []).map((step) => ({ ...step, verified: verified.some((t) => sameTool(t, step.tool)) }));
  return {
    piece: { ...piece, workflow },
    creator: { ...creatorSummary(profile), commerciallySafe: !!profile.commerciallySafe, ...trustFields(profile) },
  };
}
