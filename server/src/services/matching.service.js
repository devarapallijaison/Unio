import { CreatorProfile, PortfolioItem } from '../models/index.js';
import { CONTENT_TYPES, FORMATS, SKILLS, SPECIALIZATIONS } from '../models/taxonomy.js';
import { CONTENT_GROUPS, requireOwnCampaign } from './campaigns.service.js';
import { creatorSummary } from './serializers.js';

/**
 * F4 — explainable rule-based match between a campaign and a creator (guide §7 F4).
 * The score is a relevance hint, not a prediction of outcome. "We never hide why someone ranks high":
 * every point is in `breakdown`, positives in `reasons`, lost points in `warnings`.
 * Weights are proposed and kept in this one constant (sum = 100).
 */
export const WEIGHTS = Object.freeze({
  contentType: 20,
  skills: 20,
  tools: 15,
  industry: 10,
  budget: 10,
  trust: 10,
  format: 5,
  language: 5,
  availability: 5,
});

const SIGNAL_LABELS = {
  contentType: 'Content type',
  skills: 'Skills (backed by work)',
  tools: 'Tools',
  industry: 'Industry',
  budget: 'Budget',
  trust: 'UNIO Trust',
  format: 'Format',
  language: 'Language',
  availability: 'Availability',
};

const TRUST_POINTS = { 5: 10, 4: 8, 3: 6, 2: 3, 1: 0 };
const TOOL_CREDIT = { verified: 1, certified: 0.75, self: 0.5 };

const lower = (list = []) => list.map((s) => String(s).toLowerCase().trim());
const has = (list, value) => lower(list).includes(String(value).toLowerCase().trim());
const labelOf = (list, id) => list.find((o) => o.id === id)?.label ?? id;
const groupOf = (type) => Object.entries(CONTENT_GROUPS).find(([, types]) => types.includes(type))?.[0];
const joinAnd = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** "Short-form video (Reels/Shorts)" → "short-form video (Reels/Shorts)" (keeps names and acronyms). */
const lcFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const kINR = (n) => `₹${n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace('.0K', 'K') : n}`;

/** Per-tool trust state used by matching. Expired verifications (Phase 8) are dropped from verifiedTools upstream. */
export function toolState(creator, tool) {
  if (has(creator.verifiedTools, tool)) return 'verified';
  if (has(creator.certifiedTools, tool)) return 'certified';
  if (has(creator.tools, tool)) return 'self';
  return null;
}

/**
 * Pure scorer. `evidence` = { skillCounts: {skillId: n}, industryCounts: {specId: n} } from the creator's
 * portfolio (see evidenceFor). Without evidence, no skill counts as backed.
 */
export function scoreMatch(campaign, creator, evidence = {}) {
  const skillCounts = evidence.skillCounts ?? {};
  const industryCounts = evidence.industryCounts ?? {};
  const pts = {};
  const reasons = [];
  const warnings = [];

  // Content type (20): exact → 20; same family (e.g. ad ↔ short video) → 10; unspecified → half.
  const type = campaign.contentType;
  if (!type) pts.contentType = WEIGHTS.contentType / 2;
  else if (has(creator.contentTypes, type)) {
    pts.contentType = WEIGHTS.contentType;
    reasons.push(`Makes ${lcFirst(labelOf(CONTENT_TYPES, type))}`);
  } else if (groupOf(type) && (creator.contentTypes ?? []).some((t) => groupOf(t) === groupOf(type))) {
    pts.contentType = WEIGHTS.contentType / 2;
    warnings.push(`Related content type, not ${lcFirst(labelOf(CONTENT_TYPES, type))} — lost ${WEIGHTS.contentType / 2} points`);
  } else pts.contentType = 0;

  // Skills (20): share of required skills the creator lists AND shows in at least one piece.
  const reqSkills = campaign.requiredSkills ?? [];
  if (!reqSkills.length) pts.skills = WEIGHTS.skills / 2;
  else {
    const backed = reqSkills.filter((s) => has(creator.skills, s) && (skillCounts[s] ?? 0) > 0);
    const unbacked = reqSkills.filter((s) => has(creator.skills, s) && !(skillCounts[s] > 0));
    pts.skills = (backed.length / reqSkills.length) * WEIGHTS.skills;
    if (backed.length) reasons.push(`${joinAnd(backed.map((s) => labelOf(SKILLS, s)))} shown in their work`);
    if (unbacked.length) warnings.push(`${joinAnd(unbacked.map((s) => labelOf(SKILLS, s)))} listed but not shown in a piece yet`);
  }

  // Tools (15): verified 1, certified 0.75, self-reported 0.5; average × 15.
  const reqTools = campaign.requiredTools ?? [];
  if (!reqTools.length) pts.tools = WEIGHTS.tools / 2;
  else {
    const states = reqTools.map((t) => [t, toolState(creator, t)]);
    pts.tools = (states.reduce((sum, [, s]) => sum + (TOOL_CREDIT[s] ?? 0), 0) / reqTools.length) * WEIGHTS.tools;
    const verified = states.filter(([, s]) => s === 'verified').map(([t]) => t);
    const certified = states.filter(([, s]) => s === 'certified').map(([t]) => t);
    const self = states.filter(([, s]) => s === 'self').map(([t]) => t);
    if (verified.length) reasons.push(`${joinAnd(verified)} verified`);
    if (certified.length) reasons.push(`${joinAnd(certified)} certified`);
    if (self.length) warnings.push(`${joinAnd(self)} self-reported — counts half`);
  }

  // Industry (10): campaign.category ∈ creator.specializations (Round 1 free-text specialties still count).
  const cat = campaign.category;
  if (cat && (has(creator.specializations, cat) || lower(creator.specialties).some((s) => s === cat || s.includes(cat)))) {
    pts.industry = WEIGHTS.industry;
    const n = industryCounts[cat] ?? 0;
    const label = labelOf(SPECIALIZATIONS, cat);
    reasons.push(n > 0 ? `${n} ${label.toLowerCase()} piece${n > 1 ? 's' : ''}` : `Specialises in ${label.toLowerCase()}`);
  } else pts.industry = 0;

  // Budget (10): starting price ≤ max → 10; ≤ 1.25 × max → 5; unknown → half.
  const price = creator.startingPrice;
  const max = campaign.budgetMax;
  if (price == null || max == null) pts.budget = WEIGHTS.budget / 2;
  else if (price <= max) {
    pts.budget = WEIGHTS.budget;
    reasons.push(campaign.budgetMin != null ? `Rate fits ${kINR(campaign.budgetMin)}–${kINR(max)}` : `Rate fits the ${kINR(max)} budget`);
  } else if (price <= max * 1.25) {
    pts.budget = WEIGHTS.budget / 2;
    warnings.push(`Starting price ${kINR(price)} is a little above the budget — lost ${WEIGHTS.budget / 2} points`);
  } else {
    pts.budget = 0;
    warnings.push(`Starting price ${kINR(price)} is above the budget`);
  }

  // Trust (10): level 5→10, 4→8, 3→6, 2→3, 1→0.
  const level = creator.trustLevel ?? 1;
  pts.trust = TRUST_POINTS[level] ?? 0;
  if (level === 5) reasons.push('★ Made on UNIO');

  // Format (5): any requested format offered; none requested → full.
  const formats = campaign.formats ?? [];
  if (!formats.length) pts.format = WEIGHTS.format;
  else {
    const hit = formats.filter((f) => has(creator.formats, f));
    pts.format = hit.length ? WEIGHTS.format : 0;
    if (hit.length) reasons.push(`Delivers ${hit.join(' + ')}`);
    else warnings.push(`Doesn’t list ${joinAnd(formats.map((f) => labelOf(FORMATS, f)))}`);
  }

  // Language (5): any requested language spoken; none requested → full.
  const langs = campaign.languages ?? [];
  if (!langs.length) pts.language = WEIGHTS.language;
  else {
    const hit = langs.filter((l) => has(creator.languages, l));
    pts.language = hit.length ? WEIGHTS.language : 0;
    if (hit.length) reasons.push(`Works in ${joinAnd(hit)}`);
    else warnings.push(`Doesn’t list ${joinAnd(langs)} — lost ${WEIGHTS.language} points`);
  }

  // Availability (5): available 5, busy 2; unavailable creators are excluded from recommendations.
  const availability = creator.availability ?? 'available';
  pts.availability = availability === 'available' ? 5 : availability === 'busy' ? 2 : 0;
  if (availability === 'busy') warnings.push('Limited availability — lost 3 availability points');
  if (availability === 'unavailable') warnings.push('Not taking work right now');

  const breakdown = Object.keys(WEIGHTS).map((signal) => ({
    signal,
    label: SIGNAL_LABELS[signal],
    points: Math.round(pts[signal] * 10) / 10,
    max: WEIGHTS[signal],
  }));
  const score = Math.round(Object.values(pts).reduce((a, b) => a + b, 0));
  return { score, reasons, warnings, breakdown, excluded: availability === 'unavailable' };
}

/** Portfolio evidence for many creators at once: skills and industries counted over their pieces. */
export async function evidenceFor(creatorIds) {
  if (!creatorIds.length) return () => ({});
  const rows = await PortfolioItem.aggregate([
    { $match: { creatorId: { $in: creatorIds } } },
    {
      $facet: {
        skills: [{ $unwind: '$skills' }, { $group: { _id: { c: '$creatorId', k: '$skills' }, n: { $sum: 1 } } }],
        industries: [{ $match: { industry: { $ne: null } } }, { $group: { _id: { c: '$creatorId', k: '$industry' }, n: { $sum: 1 } } }],
      },
    },
  ]);
  const map = new Map();
  const add = (field, { _id, n }) => {
    const key = String(_id.c);
    const entry = map.get(key) ?? { skillCounts: {}, industryCounts: {} };
    entry[field][_id.k] = n;
    map.set(key, entry);
  };
  for (const r of rows[0]?.skills ?? []) add('skillCounts', r);
  for (const r of rows[0]?.industries ?? []) add('industryCounts', r);
  return (id) => map.get(String(id)) ?? {};
}

/** Match for one creator against many campaigns (creator-side rings on P4/P5). */
export async function matchesForCreator(creator, campaigns) {
  const evidence = (await evidenceFor([creator._id]))(creator._id);
  return campaigns.map((c) => {
    const { score, reasons, warnings, breakdown } = scoreMatch(c, creator, evidence);
    return { score, reasons, warnings, breakdown };
  });
}

/** Match for many creators against one campaign (B4 applicants). */
export async function matchesForCampaign(campaign, creators) {
  const evidence = await evidenceFor(creators.map((c) => c._id));
  return creators.map((c) => {
    const { score, reasons, warnings, breakdown } = scoreMatch(campaign, c, evidence(c._id));
    return { score, reasons, warnings, breakdown };
  });
}

const PREVIEW_FIELDS = 'creatorId title mediaUrl thumbnailUrl mediaType contentType';

/** Up to `per` portfolio previews per creator (featured first). */
async function previewsFor(creatorIds, per = 2) {
  const items = await PortfolioItem.find({ creatorId: { $in: creatorIds } }, PREVIEW_FIELDS).sort({ featured: -1, createdAt: -1 }).lean();
  const map = new Map();
  for (const it of items) {
    const list = map.get(String(it.creatorId)) ?? [];
    if (list.length < per) list.push(it);
    map.set(String(it.creatorId), list);
  }
  return (id) => map.get(String(id)) ?? [];
}

export async function recommendCreators(user, campaignId, limit = 8) {
  const campaign = await requireOwnCampaign(user, campaignId);
  const creators = await CreatorProfile.find({ availability: { $ne: 'unavailable' } }).limit(500).lean();
  const evidence = await evidenceFor(creators.map((c) => c._id));
  const ranked = creators
    .map((c) => {
      const { score, reasons, warnings, breakdown } = scoreMatch(campaign, c, evidence(c._id));
      return { creator: creatorSummary(c), score, reasons, warnings, breakdown };
    })
    .sort((a, b) => b.score - a.score || (b.creator.trustLevel ?? 0) - (a.creator.trustLevel ?? 0))
    .slice(0, limit);
  const previews = await previewsFor(ranked.map((r) => r.creator._id));
  return ranked.map((r) => ({ ...r, portfolioPreview: previews(r.creator._id) }));
}
