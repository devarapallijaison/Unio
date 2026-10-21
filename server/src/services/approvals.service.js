import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { BrandProfile, Campaign, CreatorProfile, Project } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { mapBy } from '../utils/db.js';
import { CHANGES_NOTE_MIN, loadForParticipant, systemMessage } from './projects.service.js';
import { requireAgency } from './clients.service.js';

/**
 * Agency approval links (F2). The agency reviews a version first, then shares one link with its client.
 * The page behind it needs no login: the long random token is the credential, only its sha256 is stored,
 * and it works once and for seven days. The client's answer is advice to the agency (default "notify"):
 * the agency still approves or sends changes itself, so the creator only ever hears from the agency.
 */

export const LINK_DAYS = 7;
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const firstName = (name) => (name ?? '').trim().split(/\s+/)[0] || 'The client';

const stateOf = (link, now = new Date()) => (link.usedAt ? 'used' : new Date(link.expiresAt) <= now ? 'expired' : 'open');

async function byToken(token) {
  const project = await Project.findOne({ 'approvalLinks.tokenHash': hash(token) }).lean();
  if (!project) throw new ApiError(404, 'LINK_NOT_FOUND', 'This approval link is not valid. Ask your agency for a new one.');
  return { project, link: project.approvalLinks.find((l) => l.tokenHash === hash(token)) };
}

const versionOf = (project, link) => {
  const deliverable = project.deliverables.find((d) => String(d._id) === String(link.deliverableId));
  return { deliverable, version: deliverable?.versions?.find((v) => v.number === link.versionNumber) };
};

/* ---------- Agency side ---------- */

export async function createApprovalLink(user, projectId, { deliverableId, approverName, approverEmail }) {
  await requireAgency(user, { lean: true });
  const { project, role } = await loadForParticipant(user, projectId);
  if (role !== 'brand') throw ApiError.forbidden('Only the agency on this project can send approval links');
  if (!project.clientId) throw ApiError.conflict('This project has no client, so there is nobody to send a link to', 'NO_CLIENT');
  const deliverable = project.deliverables.id(deliverableId);
  if (!deliverable) throw ApiError.notFound('Deliverable not found');
  const version = deliverable.versions.find((v) => v.number === deliverable.currentVersion);
  if (!version || version.status !== 'submitted') {
    throw ApiError.conflict('Only a version that is waiting for a decision can be sent to the client', 'NOTHING_TO_APPROVE');
  }

  // Approver defaults to the one saved on the client; a link can still be addressed to someone else.
  const profile = await BrandProfile.findOne({ userId: user._id }, 'clients').lean();
  const client = profile?.clients?.find((c) => String(c._id) === String(project.clientId));
  const name = approverName?.trim() || client?.approverName || undefined;
  const email = approverEmail || client?.approverEmail || undefined;

  const now = new Date();
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + LINK_DAYS * 24 * 60 * 60 * 1000);

  // A newer link for the same version replaces the older ones, which stop working immediately.
  if (project.approvalLinks?.length) {
    await Project.updateOne(
      { _id: project._id },
      { $set: { 'approvalLinks.$[old].expiresAt': now } },
      { arrayFilters: [{ 'old.deliverableId': deliverable._id, 'old.versionNumber': version.number, 'old.usedAt': { $exists: false }, 'old.expiresAt': { $gt: now } }] },
    );
  }
  await Project.updateOne(
    { _id: project._id },
    { $push: { approvalLinks: { tokenHash: hash(token), deliverableId: deliverable._id, versionNumber: version.number, approverName: name, approverEmail: email, expiresAt } } },
  );
  await systemMessage(project._id, `Approval link sent to ${name ?? 'the client'} for v${version.number} of “${deliverable.title}”`, { deliverableId: deliverable._id, versionNumber: version.number });

  // The URL is shown once; only the hash is kept.
  return { url: `${env.publicSiteUrl}/approve/${token}`, expiresAt, approverName: name ?? null, versionNumber: version.number };
}

/** Every approval link on the agency's projects, newest first, with what the agency should do next. */
export async function listApprovals(user, { clientId } = {}) {
  await requireAgency(user, { lean: true });
  const projects = await Project.find({ brandId: user._id, 'approvalLinks.0': { $exists: true }, ...(clientId ? { clientId } : {}) }).lean();
  const campaigns = await mapBy(Campaign, projects.map((p) => p.campaignId), { projection: 'title' });
  const now = new Date();
  const items = [];
  for (const p of projects) {
    for (const link of p.approvalLinks) {
      const { deliverable, version } = versionOf(p, link);
      const waiting = version?.status === 'submitted';
      const state = stateOf(link, now);
      items.push({
        _id: link._id,
        projectId: p._id,
        projectTitle: campaigns.get(String(p.campaignId))?.title ?? 'Project',
        deliverableId: link.deliverableId,
        deliverableTitle: deliverable?.title ?? 'Deliverable',
        versionNumber: link.versionNumber,
        clientId: p.clientId,
        clientName: p.clientName,
        approverName: link.approverName ?? null,
        createdAt: link.createdAt,
        expiresAt: link.expiresAt,
        openedAt: link.openedAt ?? null,
        usedAt: link.usedAt ?? null,
        decision: link.decision ?? null,
        note: link.note ?? '',
        // awaiting: sent, client not answered · answered: client replied, agency still has to decide · closed: nothing left to do
        status: !waiting ? 'closed' : state === 'open' ? 'awaiting' : state === 'used' ? 'answered' : 'expired',
      });
    }
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Only the newest link per version counts for "awaiting": replaced links must not inflate the number.
  const latest = new Map();
  for (const i of items) {
    const key = `${i.projectId}:${i.deliverableId}:${i.versionNumber}`;
    if (!latest.has(key)) latest.set(key, i._id);
  }
  const current = items.filter((i) => latest.get(`${i.projectId}:${i.deliverableId}:${i.versionNumber}`) === i._id);
  return {
    items: current,
    counts: { awaiting: current.filter((i) => i.status === 'awaiting').length, answered: current.filter((i) => i.status === 'answered').length },
  };
}

/* ---------- Client side (no login) ---------- */

export async function getApproval(token) {
  const { project, link } = await byToken(token);
  const { deliverable, version } = versionOf(project, link);
  const [campaign, brand, creator] = await Promise.all([
    Campaign.findById(project.campaignId, 'title').lean(),
    BrandProfile.findOne({ userId: project.brandId }, 'companyName').lean(),
    CreatorProfile.findById(project.creatorId, 'displayName').lean(),
  ]);
  let state = stateOf(link);
  // The agency may have decided already: then there is nothing left for the client to do.
  if (state === 'open' && version?.status !== 'submitted') state = 'closed';
  if (state === 'open' && !link.openedAt) {
    await Project.updateOne({ _id: project._id }, { $set: { 'approvalLinks.$[l].openedAt': new Date() } }, { arrayFilters: [{ 'l.tokenHash': hash(token), 'l.openedAt': { $exists: false } }] });
  }
  return {
    state, // open | used | expired | closed
    decision: state === 'used' ? link.decision : null,
    clientName: project.clientName ?? null,
    agencyName: brand?.companyName ?? null,
    approverName: link.approverName ?? null,
    projectTitle: campaign?.title ?? 'Project',
    deliverableTitle: deliverable?.title ?? 'Deliverable',
    creatorName: creator?.displayName ?? null,
    expiresAt: link.expiresAt,
    // The work itself is only shown while the link can still be used.
    version:
      state === 'open' && version
        ? { number: version.number, mediaUrl: version.mediaUrl, thumbnailUrl: version.thumbnailUrl ?? null, changeNote: version.changeNote, toolsUsed: version.toolsUsed ?? [] }
        : null,
  };
}

export async function decideApproval(token, { decision, note, approverName }) {
  const trimmed = (note ?? '').trim();
  if (decision === 'changes' && trimmed.length < CHANGES_NOTE_MIN) {
    throw new ApiError(400, 'NOTE_REQUIRED', `Say what should change (at least ${CHANGES_NOTE_MIN} characters)`, [
      { location: 'body', field: 'note', message: `Say what should change (at least ${CHANGES_NOTE_MIN} characters)` },
    ]);
  }
  const { project, link } = await byToken(token);
  const state = stateOf(link);
  if (state === 'used') throw new ApiError(409, 'LINK_USED', 'This link has already been used. Your answer was recorded.');
  if (state === 'expired') throw new ApiError(410, 'LINK_EXPIRED', 'This link has expired. Ask your agency for a new one.');
  const { deliverable, version } = versionOf(project, link);
  if (version?.status !== 'submitted') throw new ApiError(409, 'LINK_CLOSED', 'Your agency has already decided on this version.');

  // One decision per link: the first to claim it wins, atomically.
  const now = new Date();
  const claimed = await Project.findOneAndUpdate(
    { _id: project._id, approvalLinks: { $elemMatch: { tokenHash: hash(token), usedAt: { $exists: false }, expiresAt: { $gt: now } } } },
    {
      $set: {
        'approvalLinks.$.usedAt': now,
        'approvalLinks.$.decision': decision === 'approve' ? 'approved' : 'changes',
        'approvalLinks.$.note': trimmed,
        ...(approverName?.trim() ? { 'approvalLinks.$.approverName': approverName.trim() } : {}),
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) throw new ApiError(409, 'LINK_USED', 'This link has already been used. Your answer was recorded.');

  const who = approverName?.trim() || link.approverName || 'The client';
  await systemMessage(
    project._id,
    decision === 'approve'
      ? `${who} approved v${link.versionNumber} of “${deliverable.title}” through the approval link. Confirm to approve it`
      : `${who} asked for changes to v${link.versionNumber} of “${deliverable.title}” through the approval link. Review their note`,
    { deliverableId: deliverable._id, versionNumber: link.versionNumber },
  );
  return { state: 'used', decision: decision === 'approve' ? 'approved' : 'changes', first: firstName(who) };
}
