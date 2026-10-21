import { BrandProfile, Campaign, Project } from '../models/index.js';
import { CLIENT_COLOR_IDS } from '../models/taxonomy.js';
import { ApiError } from '../utils/ApiError.js';

/** Agency clients (F2, guide §5.4): colour-tagged, each with an approver. Agencies are role 'brand' + accountType 'agency'. */

const MAX_CLIENTS = 50;

export const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** The first tag colour no active client is using; cycles once all eight are taken. */
export function nextColor(clients) {
  const used = new Set(clients.filter((c) => !c.archived).map((c) => c.color));
  return CLIENT_COLOR_IDS.find((c) => !used.has(c)) ?? CLIENT_COLOR_IDS[clients.length % CLIENT_COLOR_IDS.length];
}

/** The signed-in brand's profile, only if it is an agency. Brands get 403: clients are an agency feature. */
export async function requireAgency(user, { lean = false } = {}) {
  const query = BrandProfile.findOne({ userId: user._id });
  const profile = lean ? await query.lean() : await query;
  if (!profile || profile.accountType !== 'agency') throw ApiError.forbidden('Clients are available on agency accounts');
  return profile;
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function view(client, counts = {}) {
  const c = client.toObject ? client.toObject() : client;
  return {
    _id: c._id,
    name: c.name,
    industry: c.industry ?? null,
    initials: c.initials || initialsOf(c.name),
    color: c.color ?? CLIENT_COLOR_IDS[0],
    approverName: c.approverName ?? '',
    approverEmail: c.approverEmail ?? '',
    archived: !!c.archived,
    campaigns: counts.campaigns ?? 0,
    projects: counts.projects ?? 0,
    awaiting: counts.awaiting ?? 0,
  };
}

export async function listClients(user) {
  const profile = await requireAgency(user, { lean: true });
  const clients = (profile.clients ?? []).filter((c) => !c.archived);
  const [campaigns, projects, awaiting] = await Promise.all([
    Campaign.aggregate([{ $match: { brandId: user._id, clientId: { $in: clients.map((c) => c._id) } } }, { $group: { _id: '$clientId', n: { $sum: 1 } } }]),
    Project.aggregate([{ $match: { brandId: user._id, clientId: { $in: clients.map((c) => c._id) } } }, { $group: { _id: '$clientId', n: { $sum: 1 } } }]),
    // "Awaiting" = approval links that are still open: the client has not answered and the link has not run out.
    Project.aggregate([
      { $match: { brandId: user._id, clientId: { $in: clients.map((c) => c._id) } } },
      { $unwind: '$approvalLinks' },
      { $match: { 'approvalLinks.usedAt': null, 'approvalLinks.expiresAt': { $gt: new Date() } } },
      { $group: { _id: '$clientId', n: { $sum: 1 } } },
    ]),
  ]);
  const by = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [cMap, pMap, aMap] = [by(campaigns), by(projects), by(awaiting)];
  return clients.map((c) =>
    view(c, { campaigns: cMap.get(String(c._id)), projects: pMap.get(String(c._id)), awaiting: aMap.get(String(c._id)) }),
  );
}

export async function createClient(user, body) {
  const profile = await requireAgency(user);
  if (profile.clients.length >= MAX_CLIENTS) throw ApiError.conflict(`You can have up to ${MAX_CLIENTS} clients`, 'CLIENT_LIMIT');
  if (profile.clients.some((c) => !c.archived && sameName(c.name, body.name))) {
    throw ApiError.conflict('You already have a client with this name', 'CLIENT_EXISTS');
  }
  profile.clients.push({
    name: body.name,
    industry: body.industry || undefined,
    initials: initialsOf(body.name),
    color: body.color ?? nextColor(profile.clients),
    approverName: body.approverName || undefined,
    approverEmail: body.approverEmail || undefined,
  });
  await profile.save();
  return view(profile.clients.at(-1));
}

export async function updateClient(user, clientId, body) {
  const profile = await requireAgency(user);
  const client = profile.clients.id(clientId);
  if (!client || client.archived) throw ApiError.notFound('Client not found');
  if (profile.clients.some((c) => !c.archived && String(c._id) !== String(clientId) && sameName(c.name, body.name))) {
    throw ApiError.conflict('You already have a client with this name', 'CLIENT_EXISTS');
  }
  client.name = body.name;
  client.initials = initialsOf(body.name);
  client.industry = body.industry || undefined;
  if (body.color) client.color = body.color;
  client.approverName = body.approverName || undefined;
  client.approverEmail = body.approverEmail || undefined;
  await profile.save();
  // Briefs carry a copy of the name so public pages need no lookup; keep the copies in step.
  await Promise.all([
    Campaign.updateMany({ brandId: user._id, clientId }, { $set: { clientName: body.name } }),
    Project.updateMany({ brandId: user._id, clientId }, { $set: { clientName: body.name } }),
  ]);
  return view(client);
}

/** Archive, never delete: past briefs and projects keep their client. Archived clients leave the switcher and "New brief for…". */
export async function archiveClient(user, clientId) {
  const profile = await requireAgency(user);
  const client = profile.clients.id(clientId);
  if (!client || client.archived) throw ApiError.notFound('Client not found');
  client.archived = true;
  await profile.save();
  return { archived: true };
}
