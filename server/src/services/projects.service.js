import { BrandProfile, Campaign, CreatorProfile, Project } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { pageResult, paginate } from '../utils/http.js';
import { campaignSummary, creatorSummary, publicBrand } from './serializers.js';

function deliverablesFromCampaign(campaign) {
  const specs = campaign.deliverables?.length
    ? campaign.deliverables
    : [{ title: 'Final delivery', description: 'Agreed creative assets for this campaign', quantity: 1 }];
  return specs.map((d) => ({
    title: d.quantity > 1 ? `${d.title} ×${d.quantity}` : d.title,
    description: d.description ?? '',
    dueDate: campaign.deadline ?? undefined,
    status: 'pending',
  }));
}

/**
 * Creates the single project for a campaign/creator pair, or returns the existing one.
 * The upsert plus the unique { campaignId, creatorId } index make this idempotent.
 */
export async function createProjectFromSource({ campaign, creatorId, sourceType, sourceId }, session) {
  try {
    return await Project.findOneAndUpdate(
      { campaignId: campaign._id, creatorId },
      {
        $setOnInsert: {
          campaignId: campaign._id,
          creatorId,
          brandId: campaign.brandId,
          sourceType,
          sourceId,
          status: 'not_started',
          deliverables: deliverablesFromCampaign(campaign),
        },
      },
      { upsert: true, returnDocument: 'after', session, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    // A concurrent upsert can lose the race on the unique index; the winner's project is the one we want.
    if (err?.code === 11000) return Project.findOne({ campaignId: campaign._id, creatorId }).session(session).lean();
    throw err;
  }
}

async function hydrate(projects) {
  const [campaigns, creators, brands] = await Promise.all([
    mapBy(Campaign, projects.map((p) => p.campaignId)),
    mapBy(CreatorProfile, projects.map((p) => p.creatorId)),
    mapBy(BrandProfile, projects.map((p) => p.brandId), { key: 'userId' }),
  ]);
  return projects.map((p) => ({
    ...p,
    campaign: campaignSummary(campaigns.get(String(p.campaignId))),
    creator: creatorSummary(creators.get(String(p.creatorId))),
    brand: publicBrand(brands.get(String(p.brandId))),
  }));
}

export async function listProjects(filter, q) {
  if (q.status) filter.status = q.status;
  const pg = paginate(q);
  const [docs, total] = await Promise.all([
    Project.find(filter).sort({ updatedAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Project.countDocuments(filter),
  ]);
  return pageResult(await hydrate(docs), total, pg);
}

/** Who is this user in the project? Returns 'creator' | 'brand' or throws 404 for non-participants. */
async function participantRole(project, user) {
  if (user.role === 'brand' && String(project.brandId) === String(user._id)) return 'brand';
  if (user.role === 'creator') {
    const profile = await CreatorProfile.findOne({ userId: user._id }, '_id').lean();
    if (profile && String(profile._id) === String(project.creatorId)) return 'creator';
  }
  throw ApiError.notFound('Project not found');
}

export async function getProject(user, id) {
  const project = await Project.findById(id).lean();
  if (!project) throw ApiError.notFound('Project not found');
  const role = await participantRole(project, user);
  const [hydrated] = await hydrate([project]);
  const campaign = await Campaign.findById(project.campaignId, 'brief deliverables requiredSkills requiredTools').lean();
  return { project: { ...hydrated, campaign: { ...hydrated.campaign, ...campaign } }, viewerRole: role };
}

/** Allowed project transitions per participant role. */
export const PROJECT_TRANSITIONS = {
  creator: {
    not_started: ['in_progress'],
    in_progress: ['submitted'],
    revision_requested: ['in_progress', 'submitted'],
  },
  brand: {
    not_started: ['cancelled'],
    in_progress: ['cancelled'],
    submitted: ['completed', 'revision_requested', 'cancelled'],
    revision_requested: ['cancelled'],
  },
};

export async function updateProjectStatus(user, id, status) {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  const role = await participantRole(project, user);

  if (!PROJECT_TRANSITIONS[role][project.status]?.includes(status)) {
    throw ApiError.invalidTransition(project.status, status);
  }
  if (status === 'submitted' && project.deliverables.some((d) => !['submitted', 'approved'].includes(d.status))) {
    throw ApiError.conflict('Submit every deliverable before submitting the project', 'DELIVERABLES_INCOMPLETE');
  }
  if (status === 'completed' && project.deliverables.some((d) => d.status !== 'approved')) {
    throw ApiError.conflict('Approve every deliverable before completing the project', 'DELIVERABLES_INCOMPLETE');
  }

  project.status = status;
  await project.save();
  return getProject(user, id);
}

/** Brand feedback: real, one-time, only after the work is completed. */
export async function addFeedback(user, id, { rating, comment }) {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  const role = await participantRole(project, user);
  if (role !== 'brand') throw ApiError.forbidden('Only the brand on this project can leave feedback');
  if (project.status !== 'completed') throw ApiError.conflict('Feedback can be left once the project is completed', 'NOT_COMPLETED');
  if (project.feedback?.rating) throw ApiError.conflict('Feedback has already been left for this project', 'ALREADY_REVIEWED');
  project.feedback = { rating, comment: comment ?? '', createdAt: new Date() };
  await project.save();
  return getProject(user, id);
}

const DELIVERABLE_TRANSITIONS = {
  creator: { pending: ['submitted'], revision_requested: ['submitted'] },
  brand: { submitted: ['approved', 'revision_requested'] },
};

export async function updateDeliverable(user, id, deliverableId, { mediaUrl, status }) {
  const project = await Project.findById(id);
  if (!project) throw ApiError.notFound('Project not found');
  const role = await participantRole(project, user);
  if (['completed', 'cancelled'].includes(project.status)) {
    throw ApiError.conflict(`This project is ${project.status} and can no longer be changed`, 'PROJECT_CLOSED');
  }

  const deliverable = project.deliverables.id(deliverableId);
  if (!deliverable) throw ApiError.notFound('Deliverable not found');

  if (mediaUrl !== undefined) {
    if (role !== 'creator') throw ApiError.forbidden('Only the creator can attach delivery media');
    if (!['pending', 'revision_requested'].includes(deliverable.status)) {
      throw ApiError.conflict('Media can only be changed before the deliverable is submitted', 'INVALID_TRANSITION');
    }
    deliverable.mediaUrl = mediaUrl || undefined;
  }

  if (status !== undefined && status !== deliverable.status) {
    if (!DELIVERABLE_TRANSITIONS[role][deliverable.status]?.includes(status)) {
      throw ApiError.invalidTransition(deliverable.status, status);
    }
    if (status === 'submitted' && !deliverable.mediaUrl) {
      throw ApiError.badRequest('Add a media link before submitting this deliverable', [
        { location: 'body', field: 'mediaUrl', message: 'Media link is required to submit' },
      ]);
    }
    deliverable.status = status;
    // Keep the overall project state in step with deliverable activity.
    if (role === 'creator' && project.status === 'not_started') project.status = 'in_progress';
    if (role === 'brand' && status === 'revision_requested') project.status = 'revision_requested';
  }

  await project.save();
  return getProject(user, id);
}
