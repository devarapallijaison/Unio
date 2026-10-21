import { Campaign, CreatorProfile, Invitation, PortfolioItem } from '../models/index.js';
import { CATEGORIES, CONTENT_TYPES, SKILLS, SPECIALIZATIONS, STYLES } from '../models/taxonomy.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { ciExact, escapeRegex, pageResult, paginate } from '../utils/http.js';
import { creatorSummary, publicCreator, trustFields } from './serializers.js';
import { refreshExpiredTrust } from './trust.service.js';
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

/* ------------------------------------------------------------------ */
/* Discover (guide F1-b): OR within one filter, AND across filters.    */
/* ------------------------------------------------------------------ */

/** Taxonomy ids whose label contains the search text ("food" → food, "lip" → lipsync). */
function labelIds(list, text) {
  const t = text.toLowerCase();
  return list.filter((o) => o.label.toLowerCase().includes(t) || o.id.toLowerCase() === t).map((o) => o.id);
}

const hasAny = (path) => ({ [`${path}.0`]: { $exists: true } });

/**
 * One Mongo condition per active filter, keyed by facet name, so facet counts can apply
 * "every other filter but not its own".
 */
export function discoverClauses(q) {
  const c = {};
  const text = q.q ?? q.search;
  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    c.q = {
      $or: [
        { displayName: rx },
        { headline: rx },
        { bio: rx },
        { location: rx },
        { tools: rx },
        { category: { $in: labelIds(CATEGORIES, text) } },
        { secondaryCategories: { $in: labelIds(CATEGORIES, text) } },
        { skills: { $in: labelIds(SKILLS, text) } },
        { specializations: { $in: labelIds(SPECIALIZATIONS, text) } },
        { contentTypes: { $in: labelIds(CONTENT_TYPES, text) } },
        { styles: { $in: labelIds(STYLES, text) } },
      ],
    };
  }
  if (q.cat) c.cat = { $or: [{ category: { $in: q.cat } }, { secondaryCategories: { $in: q.cat } }] };
  if (q.types) c.types = { contentTypes: { $in: q.types } };
  if (q.spec) c.spec = { specializations: { $in: q.spec } };
  if (q.skills) c.skills = { skills: { $in: q.skills } };
  if (q.tools) c.tools = q.vonly ? { verifiedTools: { $in: q.tools } } : { tools: { $in: q.tools } };
  else if (q.vonly) c.vonly = hasAny('verifiedTools');
  if (q.styles) c.styles = { styles: { $in: q.styles } };
  if (q.formats) c.formats = { formats: { $in: q.formats } };
  if (q.langs) c.langs = { languages: { $in: q.langs } };
  if (q.trust) {
    const t = { v: hasAny('verifiedTools'), c: hasAny('certifiedTools'), m: { madeOnUnioCount: { $gt: 0 } } };
    c.trust = { $or: q.trust.map((k) => t[k]) };
  }
  if (q.maxPrice != null || q.minPrice != null) {
    c.price = { startingPrice: { ...(q.minPrice != null && { $gte: q.minPrice }), ...(q.maxPrice != null && { $lte: q.maxPrice }) } };
  }
  if (q.maxDays != null) c.days = { turnaroundDays: { $lte: q.maxDays } };
  if (q.avail) c.avail = { availability: 'available' };
  else if (q.availability) c.avail = { availability: q.availability };
  // Round 1 single-value aliases
  if (q.skill) c.skillAlias = { skills: ciExact(q.skill) };
  if (q.tool) c.toolAlias = { tools: ciExact(q.tool) };
  if (q.specialty) c.specAlias = { $or: [{ specializations: q.specialty }, { specialties: ciExact(q.specialty) }] };
  return c;
}

const matchFor = (clauses, except) => {
  const list = Object.entries(clauses).filter(([k]) => k !== except).map(([, v]) => v);
  return list.length ? { $and: list } : {};
};

/** Missing prices / turnarounds sort last. */
const SORT_STAGES = {
  rating: [{ $addFields: { _r: { $ifNull: ['$ratingAvg', -1] } } }, { $sort: { _r: -1, madeOnUnioCount: -1, trustLevel: -1, featured: -1, _id: 1 } }],
  mou: [{ $sort: { madeOnUnioCount: -1, trustLevel: -1, _id: 1 } }],
  price: [{ $addFields: { _p: { $ifNull: ['$startingPrice', 1e15] } } }, { $sort: { _p: 1, _id: 1 } }],
  fast: [{ $addFields: { _d: { $ifNull: ['$turnaroundDays', 1e6] } } }, { $sort: { _d: 1, _id: 1 } }],
  newest: [{ $sort: { createdAt: -1, _id: 1 } }],
  featured: [{ $sort: SORTS.featured }],
  price_asc: [{ $sort: SORTS.price_asc }],
  price_desc: [{ $sort: SORTS.price_desc }],
};

const countBy = (path) => [{ $unwind: `$${path}` }, { $group: { _id: `$${path}`, n: { $sum: 1 } } }];
const asMap = (rows) => Object.fromEntries(rows.filter((r) => r._id != null).map((r) => [r._id, r.n]));

/**
 * Results + facet counts in one aggregation. Each facet applies every active filter except its own
 * (standard faceted search), so ticking "Kling" never zeroes out the other tools.
 */
async function discover(q, pg) {
  const clauses = discoverClauses(q);
  const toolsPath = q.vonly ? 'verifiedTools' : 'tools';
  const facetOf = (key, path) => [{ $match: matchFor(clauses, key) }, ...countBy(path)];
  const [out] = await CreatorProfile.aggregate([
    {
      $facet: {
        items: [{ $match: matchFor(clauses) }, ...(SORT_STAGES[q.sort] ?? SORT_STAGES.rating), { $skip: pg.skip }, { $limit: pg.limit }],
        total: [{ $match: matchFor(clauses) }, { $count: 'n' }],
        cat: [
          { $match: matchFor(clauses, 'cat') },
          { $project: { c: { $setUnion: [[{ $ifNull: ['$category', null] }], { $ifNull: ['$secondaryCategories', []] }] } } },
          ...countBy('c'),
        ],
        types: facetOf('types', 'contentTypes'),
        spec: facetOf('spec', 'specializations'),
        skills: facetOf('skills', 'skills'),
        tools: facetOf('tools', toolsPath),
        styles: facetOf('styles', 'styles'),
        formats: facetOf('formats', 'formats'),
        langs: facetOf('langs', 'languages'),
        trust: [
          { $match: matchFor(clauses, 'trust') },
          {
            $group: {
              _id: null,
              v: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$verifiedTools', []] } }, 0] }, 1, 0] } },
              c: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$certifiedTools', []] } }, 0] }, 1, 0] } },
              m: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$madeOnUnioCount', 0] }, 0] }, 1, 0] } },
            },
          },
        ],
        all: [{ $match: matchFor(clauses, 'cat') }, { $count: 'n' }],
      },
    },
  ]);
  const { _id: _t, ...trust } = out.trust[0] ?? { v: 0, c: 0, m: 0 };
  const facets = {
    cat: asMap(out.cat),
    types: asMap(out.types),
    spec: asMap(out.spec),
    skills: asMap(out.skills),
    tools: asMap(out.tools),
    styles: asMap(out.styles),
    formats: asMap(out.formats),
    langs: asMap(out.langs),
    trust,
    allCategories: out.all[0]?.n ?? 0, // "All creators" tile: every filter except category
  };
  return { docs: out.items, total: out.total[0]?.n ?? 0, facets };
}

export async function listCreators(q) {
  const pg = paginate(q);
  const { docs, total, facets } = await discover(q, pg);
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
  return {
    ...pageResult(
      docs.map((d) => ({ ...publicCreator(d, skillsFor(d._id)), ...countsFor(d._id), portfolioPreview: previews.get(String(d._id)) ?? [] })),
      total,
      pg,
    ),
    facets,
  };
}

export async function getCreator(id, viewer) {
  await refreshExpiredTrust(id).catch(() => {});
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
