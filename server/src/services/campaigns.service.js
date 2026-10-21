import mongoose from 'mongoose';
import { Application, BrandProfile, Campaign, Project } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { ciExact, escapeRegex, pageResult, paginate } from '../utils/http.js';
import { missingRights, publicBrand, withRights } from './serializers.js';

const PUBLIC_SORTS = {
  newest: { createdAt: -1, _id: 1 },
  deadline: { deadline: 1, _id: 1 },
  budget_desc: { budgetMax: -1, _id: 1 },
};

/** P4 chips group content types the way creators think about them. */
export const CONTENT_GROUPS = {
  video: ['short', 'long', 'ad', 'musicvid'],
  ugc: ['ugcv', 'avatar'],
  images: ['photo', 'static', 'poster', 'thumb'],
  '3d': ['render3d'],
  motion: ['motion', 'anim'],
};

/** Attach the public brand profile (keyed by campaign.brandId → brandProfiles.userId). */
export async function attachBrands(campaigns) {
  const brands = await mapBy(BrandProfile, campaigns.map((c) => c.brandId), { key: 'userId' });
  return campaigns.map((c) => ({ ...withRights(c), brand: publicBrand(brands.get(String(c.brandId))) }));
}

/** Public directory. `all` returns every match (capped) for in-memory ranking by creator match (P4 Best match). */
export async function listPublicCampaigns(q, { all = false } = {}) {
  const filter = { status: 'open' };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ title: rx }, { brief: rx }, { category: rx }, { requiredSkills: rx }, { requiredTools: rx }];
  }
  if (q.category) filter.category = ciExact(q.category);
  if (q.skill) filter.requiredSkills = ciExact(q.skill);
  if (q.tool) filter.requiredTools = ciExact(q.tool);
  if (q.group?.length) filter.contentType = { $in: q.group.flatMap((g) => CONTENT_GROUPS[g] ?? []) };
  if (q.exclusive) filter['rights.exclusive'] = true;
  // Budget filters match campaigns whose range overlaps the requested range.
  if (q.minBudget != null) filter.budgetMax = { $gte: q.minBudget };
  if (q.maxBudget != null) filter.budgetMin = { $lte: q.maxBudget };

  if (all) return attachBrands(await Campaign.find(filter).sort(PUBLIC_SORTS.newest).limit(500).lean());
  const pg = paginate(q);
  const [docs, total] = await Promise.all([
    Campaign.find(filter).sort(PUBLIC_SORTS[q.sort] ?? PUBLIC_SORTS.newest).skip(pg.skip).limit(pg.limit).lean(),
    Campaign.countDocuments(filter),
  ]);
  return pageResult(await attachBrands(docs), total, pg);
}

export async function listCategories() {
  const categories = await Campaign.distinct('category', { status: 'open' });
  return categories.sort((a, b) => a.localeCompare(b));
}

export async function getPublicCampaign(id, viewer, creatorProfile) {
  const campaign = await Campaign.findById(id).lean();
  const isOwner = viewer?.role === 'brand' && campaign && String(campaign.brandId) === String(viewer._id);
  // Drafts and closed campaigns are hidden from the public directory, but owners can preview them.
  if (!campaign || (campaign.status !== 'open' && !isOwner)) throw ApiError.notFound('Campaign not found');

  const [[withBrand], applicantCount] = await Promise.all([attachBrands([campaign]), Application.countDocuments({ campaignId: campaign._id })]);
  const result = { campaign: { ...withBrand, applicantCount }, viewer: null };

  if (isOwner) {
    result.viewer = { isOwner: true };
  } else if (viewer?.role === 'creator' && creatorProfile) {
    const application = await Application.findOne(
      { campaignId: campaign._id, creatorId: creatorProfile._id },
      'status proposal proposedPrice submittedAt',
    ).lean();
    result.viewer = { application };
  }
  return result;
}

/* ---------- Brand-owned campaigns ---------- */

/** Loads a campaign only if the authenticated brand owns it; otherwise 404 (no existence leak). */
export async function requireOwnCampaign(user, id, { lean = true } = {}) {
  const query = Campaign.findOne({ _id: id, brandId: user._id });
  const campaign = lean ? await query.lean() : await query;
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return campaign;
}

export async function listOwnCampaigns(user, q) {
  const filter = { brandId: user._id };
  if (q.status) filter.status = q.status;
  if (q.clientId) filter.clientId = q.clientId;
  const pg = paginate(q);
  const [docs, total, statusRows] = await Promise.all([
    Campaign.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Campaign.countDocuments(filter),
    Campaign.aggregate([{ $match: { brandId: user._id, ...(q.clientId ? { clientId: new mongoose.Types.ObjectId(q.clientId) } : {}) } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  const counts = await Application.aggregate([
    { $match: { campaignId: { $in: docs.map((d) => d._id) } } },
    { $group: { _id: { campaignId: '$campaignId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byCampaign = new Map();
  for (const { _id, n } of counts) {
    const key = String(_id.campaignId);
    const entry = byCampaign.get(key) ?? { total: 0, pending: 0, accepted: 0 };
    entry.total += n;
    if (_id.status === 'pending') entry.pending += n;
    if (_id.status === 'accepted') entry.accepted += n;
    byCampaign.set(key, entry);
  }

  return {
    ...pageResult(
      docs.map((d) => ({ ...withRights(d), applicationCounts: byCampaign.get(String(d._id)) ?? { total: 0, pending: 0, accepted: 0 } })),
      total,
      pg,
    ),
    statusCounts: { draft: 0, open: 0, closed: 0, ...Object.fromEntries(statusRows.map((r) => [r._id, r.n])) },
  };
}

/** F7: a campaign can only be open when the rights questions are answered. */
function assertRightsForOpen(campaign) {
  const missing = missingRights(campaign.rights);
  if (missing.length) {
    throw new ApiError(
      409,
      'RIGHTS_REQUIRED',
      'Answer the rights questions (usage, region, duration, exclusivity) before opening this campaign. Save it as a draft for now.',
      missing.map((field) => ({ location: 'body', field: `rights.${field}`, message: 'Required before publishing' })),
    );
  }
}

/**
 * Agencies tag every brief with a client (F2). Brands cannot. The client must be one of this agency's own,
 * active clients: anything else is "not found", never a hint that another agency's client exists.
 */
async function resolveClient(user, clientId, { required }) {
  const profile = await BrandProfile.findOne({ userId: user._id }, 'accountType clients').lean();
  if (profile?.accountType !== 'agency') {
    if (clientId) throw ApiError.badRequest('Clients are for agency accounts', [{ location: 'body', field: 'clientId', message: 'Only agencies can tag a brief with a client' }]);
    return null;
  }
  if (!clientId) {
    if (!required) return null;
    throw new ApiError(400, 'CLIENT_REQUIRED', 'Choose which client this brief is for', [{ location: 'body', field: 'clientId', message: 'Choose a client' }]);
  }
  const client = (profile.clients ?? []).find((c) => String(c._id) === String(clientId) && !c.archived);
  if (!client) throw ApiError.notFound('Client not found');
  return { clientId: client._id, clientName: client.name };
}

export async function createCampaign(user, data) {
  if (data.status === 'open') assertRightsForOpen(data);
  const { clientId, ...rest } = data;
  const client = await resolveClient(user, clientId, { required: true });
  // brandId always comes from the session, never from the request body.
  const campaign = await Campaign.create({ ...rest, ...(client ?? {}), brandId: user._id });
  return withRights(campaign.toObject());
}

export async function updateCampaign(user, id, data) {
  const campaign = await requireOwnCampaign(user, id, { lean: false });
  const { clientId, ...rest } = data;
  if (clientId && String(clientId) !== String(campaign.clientId ?? '')) {
    // Moving a brief to another client is fine until work has started; after that the project keeps its client.
    if (await Project.exists({ campaignId: campaign._id })) {
      throw ApiError.conflict('This brief already has a project, so its client can no longer change.', 'CLIENT_LOCKED');
    }
    campaign.set(await resolveClient(user, clientId, { required: true }));
  }
  campaign.set(rest);
  if (campaign.status === 'open') assertRightsForOpen(campaign.toObject());
  await campaign.save();
  return withRights(campaign.toObject());
}

const CAMPAIGN_TRANSITIONS = {
  draft: ['open', 'closed'],
  open: ['closed'],
  closed: ['open'],
};

export async function setCampaignStatus(user, id, status) {
  const campaign = await requireOwnCampaign(user, id, { lean: false });
  if (campaign.status === status) return withRights(campaign.toObject());
  if (!CAMPAIGN_TRANSITIONS[campaign.status]?.includes(status)) {
    throw ApiError.invalidTransition(campaign.status, status);
  }
  if (status === 'open') assertRightsForOpen(campaign.toObject());
  campaign.status = status;
  await campaign.save();
  return withRights(campaign.toObject());
}
