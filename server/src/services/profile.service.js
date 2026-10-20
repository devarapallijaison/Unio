import { BrandProfile, CreatorProfile, PortfolioItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { VerificationSubmission } from '../models/index.js';
import { skillCountsFor } from './creators.service.js';
import { recomputeCreatorTrust } from './trust.service.js';
import { invalidatePortfolioEvidence } from './verification.service.js';

/** Resolve the authenticated creator's profile (never from client input). */
export async function requireCreatorProfile(user) {
  const profile = await CreatorProfile.findOne({ userId: user._id }).lean();
  if (!profile) throw ApiError.notFound('Creator profile not found. Complete your profile first.');
  return profile;
}

/** The owner sees every skill they listed with how many pieces prove it (0 = hidden from brands). */
async function withSkillProof(profile) {
  if (!profile) return profile;
  const countsFor = await skillCountsFor([profile._id]);
  return { ...profile, skillProof: countsFor(profile._id) };
}

export async function getOwnCreatorProfile(user) {
  return withSkillProof(await requireCreatorProfile(user));
}

export async function upsertCreatorProfile(user, data) {
  const profile = await CreatorProfile.findOneAndUpdate(
    { userId: user._id },
    { $set: data, $setOnInsert: { userId: user._id } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return withSkillProof(profile);
}

export async function getOwnBrandProfile(user) {
  const profile = await BrandProfile.findOne({ userId: user._id }).lean();
  if (!profile) throw ApiError.notFound('Brand profile not found');
  return profile;
}

export async function upsertBrandProfile(user, data) {
  return BrandProfile.findOneAndUpdate(
    { userId: user._id },
    { $set: data, $setOnInsert: { userId: user._id } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();
}

/* ---------- Portfolio (owner scoped) ---------- */

export async function listOwnPortfolio(user) {
  const profile = await requireCreatorProfile(user);
  return PortfolioItem.find({ creatorId: profile._id }).sort({ featured: -1, createdAt: -1 }).lean();
}

/** A piece's tool list always includes the tools named in its "How it was made" steps. */
function withWorkflowTools(data) {
  if (!data.workflow?.length) return data;
  const tools = [...(data.tools ?? [])];
  for (const { tool } of data.workflow) if (!tools.some((t) => t.toLowerCase() === tool.toLowerCase())) tools.push(tool);
  return { ...data, tools };
}

export async function addPortfolioItem(user, data) {
  const profile = await requireCreatorProfile(user);
  const count = await PortfolioItem.countDocuments({ creatorId: profile._id });
  if (count >= 60) throw ApiError.conflict('Portfolio limit reached (60 items)');
  const item = await PortfolioItem.create({ ...withWorkflowTools(data), creatorId: profile._id });
  return item.toObject();
}

export async function updatePortfolioItem(user, id, data) {
  const profile = await requireCreatorProfile(user);
  const before = await PortfolioItem.findOne({ _id: id, creatorId: profile._id }, 'mediaUrl').lean();
  if (!before) throw ApiError.notFound('Portfolio item not found');
  data = withWorkflowTools(data);
  const item = await PortfolioItem.findOneAndUpdate({ _id: id, creatorId: profile._id }, { $set: data }, {
    returnDocument: 'after',
    runValidators: true,
  }).lean();
  if (!item) throw ApiError.notFound('Portfolio item not found');
  if (data.mediaUrl && data.mediaUrl !== before.mediaUrl) await invalidatePortfolioEvidence(profile._id, item._id);
  return item;
}

export async function deletePortfolioItem(user, id) {
  const profile = await requireCreatorProfile(user);
  const res = await PortfolioItem.deleteOne({ _id: id, creatorId: profile._id });
  if (!res.deletedCount) throw ApiError.notFound('Portfolio item not found');
  await VerificationSubmission.deleteOne({ creatorId: profile._id, key: `portfolio:${id}` });
  await recomputeCreatorTrust(profile._id);
  return { deleted: true };
}
