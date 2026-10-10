import { Campaign, CreatorProfile, Invitation, PortfolioItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { ciExact, escapeRegex, pageResult, paginate } from '../utils/http.js';
import { publicCreator } from './serializers.js';

const SORTS = {
  featured: { featured: -1, updatedAt: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  price_asc: { startingPrice: 1, _id: 1 },
  price_desc: { startingPrice: -1, _id: 1 },
};

const PORTFOLIO_PUBLIC = 'title description mediaType mediaUrl thumbnailUrl tools category featured createdAt creatorId';

export async function listCreators(q) {
  const filter = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ displayName: rx }, { bio: rx }, { skills: rx }, { tools: rx }, { specialties: rx }, { location: rx }];
  }
  if (q.skill) filter.skills = ciExact(q.skill);
  if (q.tool) filter.tools = ciExact(q.tool);
  if (q.specialty) filter.specialties = ciExact(q.specialty);
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

  // Attach up to three portfolio previews per creator in a single query.
  const items = await PortfolioItem.find({ creatorId: { $in: docs.map((d) => d._id) } }, PORTFOLIO_PUBLIC)
    .sort({ featured: -1, createdAt: -1 })
    .lean();
  const previews = new Map();
  for (const item of items) {
    const key = String(item.creatorId);
    const list = previews.get(key) ?? [];
    if (list.length < 3) list.push(item);
    previews.set(key, list);
  }

  return pageResult(
    docs.map((d) => ({ ...publicCreator(d), portfolioPreview: previews.get(String(d._id)) ?? [] })),
    total,
    pg,
  );
}

export async function getCreator(id, viewer) {
  const profile = await CreatorProfile.findById(id).lean();
  if (!profile) throw ApiError.notFound('Creator not found');

  const portfolio = await PortfolioItem.find({ creatorId: profile._id }, PORTFOLIO_PUBLIC)
    .sort({ featured: -1, createdAt: -1 })
    .lean();

  const result = { creator: publicCreator(profile), portfolio, viewer: null };

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
