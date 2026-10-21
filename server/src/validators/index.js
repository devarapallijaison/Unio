import { z } from 'zod';
import {
  AVAILABILITY,
  CAMPAIGN_STATUS,
  DELIVERABLE_STATUS,
  MEDIA_TYPES,
  PROJECT_STATUS,
  SELF_SERVE_ROLES,
  VERIFICATION_STATUS,
  VERIFICATION_TYPES,
} from '../models/enums.js';
import {
  CATEGORY_IDS,
  CONTENT_TYPE_IDS,
  DURATION_MONTHS,
  FORMAT_IDS,
  LANGUAGE_NAMES,
  LIKENESS_IDS,
  PORTFOLIO_ALLOWED_IDS,
  REGION_IDS,
  SKILL_IDS,
  USAGE_IDS,
  SPECIALIZATION_IDS,
  STYLE_IDS,
  TEAM_SIZE_IDS,
  TOOL_NAMES,
} from '../models/taxonomy.js';
import { httpUrl, money, objectId, optionalUrl, pageQuery, qNumber, qText, tagList, text } from './common.js';

/* ---------- Auth ---------- */
const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

/** Website as typed on the join form ("masalatrail.in") — https:// is added when missing. */
const website = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() && !/^https?:\/\//i.test(v.trim()) ? `https://${v.trim()}` : v),
  httpUrl,
);

const account = {
  name: text(120, 2),
  email: emailField,
  password: passwordField,
};
const brandSide = {
  role: z.literal('brand'),
  jobTitle: text(80, 2),
};

/**
 * Sign-up fields differ by role (guide §6.1). Agencies are role 'brand' + accountType 'agency',
 * so a derived `kind` (creator | brand | agency) picks the branch. Reviewer is never self-serve.
 */
export const registerBody = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const kind = raw.role === 'brand' ? (raw.accountType === 'agency' ? 'agency' : 'brand') : raw.role;
    return { ...raw, kind };
  },
  z.discriminatedUnion(
    'kind',
    [
      z.object({
        kind: z.literal('creator'),
        role: z.literal('creator'),
        ...account,
        displayName: z.union([z.literal(''), text(120, 2)]).optional(),
        category: z.enum(CATEGORY_IDS, 'Choose what kind of creator you are'),
        city: text(120, 2),
      }),
      z.object({
        kind: z.literal('brand'),
        ...brandSide,
        accountType: z.literal('brand').default('brand'),
        ...account,
        companyName: text(160, 2),
        industry: z.enum(SPECIALIZATION_IDS, 'Choose your industry'),
        websiteUrl: z.union([z.literal(''), website]).optional(),
      }),
      z.object({
        kind: z.literal('agency'),
        ...brandSide,
        accountType: z.literal('agency'),
        ...account,
        companyName: text(160, 2),
        teamSize: z.enum(TEAM_SIZE_IDS, 'Choose your team size'),
        websiteUrl: website,
        firstClientName: z.union([z.literal(''), text(120, 2)]).optional(),
      }),
    ],
    { error: `Choose ${SELF_SERVE_ROLES.join(' or ')} (agencies sign up as brand + agency)` },
  ),
);

export const loginBody = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(128),
});

/* ---------- Public discovery ---------- */
/** Comma-separated multi-value query param → array of known ids ("a,b" or repeated params). */
const csv = (ids, label) =>
  z.preprocess(
    (v) => {
      if (v == null || v === '') return undefined;
      const list = (Array.isArray(v) ? v.join(',') : String(v)).split(',').map((s) => s.trim()).filter(Boolean);
      return list.length ? [...new Set(list)] : undefined;
    },
    z.array(z.enum(ids, `Unknown ${label}`)).max(30).optional(),
  );
const flag = z.preprocess((v) => (v === undefined || v === '' ? undefined : v === '1' || v === 'true' || v === true), z.boolean().optional());

export const DISCOVER_SORTS = ['rating', 'price', 'fast', 'mou', 'newest', 'featured', 'price_asc', 'price_desc'];

/**
 * Discover filters (guide F1-b). OR within one filter, AND across filters. Round 1 params
 * (search, skill, tool, specialty, availability, minPrice, price_* sorts) stay as aliases.
 */
export const creatorListQuery = z.object({
  q: qText,
  cat: csv(CATEGORY_IDS, 'category'),
  types: csv(CONTENT_TYPE_IDS, 'content type'),
  spec: csv(SPECIALIZATION_IDS, 'specialization'),
  skills: csv(SKILL_IDS, 'skill'),
  tools: csv(TOOL_NAMES, 'tool'),
  vonly: flag,
  styles: csv(STYLE_IDS, 'style'),
  formats: csv(FORMAT_IDS, 'format'),
  langs: csv(LANGUAGE_NAMES, 'language'),
  trust: csv(['v', 'c', 'm'], 'trust level'),
  maxPrice: qNumber,
  minPrice: qNumber,
  maxDays: qNumber,
  avail: flag,
  // Round 1 aliases
  search: qText,
  skill: qText,
  tool: qText,
  specialty: qText,
  availability: z.enum(AVAILABILITY).optional().or(z.literal('').transform(() => undefined)),
  sort: z.enum(DISCOVER_SORTS).default('rating'),
  ...pageQuery,
});

export const campaignListQuery = z.object({
  search: qText,
  category: qText,
  skill: qText,
  tool: qText,
  minBudget: qNumber,
  maxBudget: qNumber,
  // P4 chips: content-type groups (video, ugc, images, 3d, motion) and "Exclusive only".
  group: csv(['video', 'ugc', 'images', '3d', 'motion'], 'content group'),
  exclusive: flag,
  sort: z.enum(['newest', 'deadline', 'budget_desc']).default('newest'),
  ...pageQuery,
});

/* ---------- Creator profile & portfolio ---------- */

/** Controlled-list array: only known ids, deduplicated, capped. */
const idList = (ids, max, label) =>
  z
    .array(z.enum(ids, `Pick ${label} from the list`))
    .max(max, `Choose up to ${max}`)
    .transform((list) => [...new Set(list)]);

/** Optional whole number; '' or null clears it. */
const optInt = (min, max) =>
  z.preprocess((v) => (v === '' ? null : v), z.number().int().min(min).max(max).nullable().optional());

const toolName = z.enum(TOOL_NAMES, 'Pick a tool from the list');

/*
 * Trust fields (verifiedTools, certifiedTools, pendingTools, madeOnUnioCount, rating*, trustLevel),
 * featured and isDemo are computed or curated server-side: they are not in this schema, so Zod strips them.
 */
export const creatorProfileBody = z
  .object({
    displayName: text(120, 2),
    headline: text(140).optional(),
    bio: text(2000).optional(),
    photoUrl: optionalUrl,
    location: text(120).optional(),
    category: z.enum(CATEGORY_IDS, 'Choose your main category').optional(),
    secondaryCategories: idList(CATEGORY_IDS, 2, 'categories').optional(),
    contentTypes: idList(CONTENT_TYPE_IDS, CONTENT_TYPE_IDS.length, 'content types').optional(),
    specializations: idList(SPECIALIZATION_IDS, SPECIALIZATION_IDS.length, 'specializations').optional(),
    styles: idList(STYLE_IDS, STYLE_IDS.length, 'styles').optional(),
    formats: idList(FORMAT_IDS, FORMAT_IDS.length, 'formats').optional(),
    languages: idList(LANGUAGE_NAMES, LANGUAGE_NAMES.length, 'languages').optional(),
    skills: idList(SKILL_IDS, SKILL_IDS.length, 'skills').optional(),
    tools: idList(TOOL_NAMES, 20, 'tools').optional(),
    workflow: z.array(toolName).max(8, 'Up to 8 steps').optional(),
    howIWork: z.array(z.object({ title: text(60, 2), detail: text(160).optional() })).max(6, 'Up to 6 steps').optional(),
    startingPrice: money.optional().nullable(),
    turnaroundDays: optInt(1, 60),
    revisionsIncluded: optInt(0, 10),
    commerciallySafe: z.boolean().optional(),
    availability: z.enum(AVAILABILITY).optional(),
  })
  .refine((b) => !b.category || !(b.secondaryCategories ?? []).includes(b.category), {
    path: ['secondaryCategories'],
    message: 'Your main category is already included',
  });

const workflowStepBody = z.object({
  tool: toolName,
  version: text(30).optional(),
  generations: optInt(0, 100000),
  note: text(200).optional(),
});

/** madeOnUnio, projectId and contentHash are server-controlled and not accepted here. */
export const portfolioBody = z.object({
  title: text(160, 2),
  description: text(1000).optional(),
  mediaType: z.enum(MEDIA_TYPES).default('image'),
  mediaUrl: httpUrl,
  thumbnailUrl: optionalUrl,
  tools: idList(TOOL_NAMES, 20, 'tools').optional(),
  category: text(80).optional(),
  featured: z.boolean().optional(),
  contentType: z.enum(CONTENT_TYPE_IDS, 'Pick a content type').optional().nullable(),
  format: z.enum(FORMAT_IDS, 'Pick a format').optional().nullable(),
  industry: z.enum(SPECIALIZATION_IDS, 'Pick an industry').optional().nullable(),
  skills: idList(SKILL_IDS, SKILL_IDS.length, 'skills').optional(),
  styles: idList(STYLE_IDS, STYLE_IDS.length, 'styles').optional(),
  workflow: z.array(workflowStepBody).max(12, 'Up to 12 steps').optional(),
  generations: optInt(0, 100000),
  versionsCount: optInt(1, 50),
  timeTakenDays: optInt(0, 365),
  durationSec: optInt(0, 36000),
  briefSummary: text(500).optional(),
  deliveredSummary: text(500).optional(),
  licence: z
    .object({ licensedTo: text(160).optional(), summary: text(300).optional(), notForLicensing: z.boolean().optional() })
    .optional(),
  versions: z
    .array(
      z.object({
        label: text(30, 1),
        mediaUrl: optionalUrl,
        thumbnailUrl: optionalUrl,
        note: text(300).optional(),
        status: z.enum(['changes', 'approved']).optional(),
      }),
    )
    .max(10)
    .optional(),
});

/* ---------- Brand profile & campaigns ---------- */
const HEX = /^#[0-9a-f]{6}$/i;

export const brandProfileBody = z.object({
  companyName: text(160, 2),
  accountType: z.enum(['brand', 'agency']).optional(),
  logoUrl: optionalUrl,
  websiteUrl: optionalUrl,
  industry: z.enum(SPECIALIZATION_IDS, 'Choose your industry').optional(),
  description: text(2000).optional(),
  brandKit: z
    .object({
      colors: z.array(z.object({ name: text(40).optional(), hex: z.string().trim().regex(HEX, 'Use a hex colour like #8a3b2e') })).max(8, 'Up to 8 colours').optional(),
      headingFont: text(60).optional(),
      bodyFont: text(60).optional(),
      tone: z.array(text(30, 1)).max(6, 'Up to 6 tone words').optional(),
      neverDo: text(500).optional(),
      assetUrls: z.array(httpUrl).max(12, 'Up to 12 assets').optional(),
    })
    .optional(),
});

const deliverableSpec = z.object({
  title: text(160, 1),
  description: text(1000).optional(),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

/** F7 rights. Every part optional here (drafts may be incomplete); opening a campaign requires usage/region/duration/exclusive (service). */
const rightsBody = z.object({
  usage: idList(USAGE_IDS, USAGE_IDS.length, 'usage').optional(),
  region: z.enum(REGION_IDS, 'Pick a region').optional().nullable(),
  regionNote: text(120).optional(),
  durationMonths: z.union(DURATION_MONTHS.map((m) => z.literal(m)), 'Pick a duration').optional().nullable(),
  exclusive: z.boolean().optional().nullable(),
  portfolioAllowed: z.enum(PORTFOLIO_ALLOWED_IDS).optional(),
  commerciallySafeTools: z.boolean().optional(),
  aiLabel: z.boolean().optional(),
  likeness: z.enum(LIKENESS_IDS).optional(),
});

/** aiFilledFields lists which fields the AI filled and the brand hasn't edited (UI tint only). */
const AI_FIELD_NAMES = ['title', 'category', 'brief', 'contentType', 'formats', 'lengthNote', 'style', 'languages', 'budget', 'deliverables', 'deadline', 'requiredTools', 'requiredSkills', 'rights'];

export const campaignBody = z
  .object({
    title: text(160, 4),
    brief: text(5000, 20),
    category: z.enum(SPECIALIZATION_IDS, 'Choose an industry'),
    budgetMin: money.optional().nullable(),
    budgetMax: money.optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    requiredSkills: idList(SKILL_IDS, SKILL_IDS.length, 'skills').optional(),
    requiredTools: idList(TOOL_NAMES, 20, 'tools').optional(),
    deliverables: z.array(deliverableSpec).max(20).optional(),
    status: z.enum(CAMPAIGN_STATUS).default('draft'),
    contentType: z.enum(CONTENT_TYPE_IDS, 'Pick a content type').optional().nullable(),
    formats: idList(FORMAT_IDS, FORMAT_IDS.length, 'formats').optional(),
    style: text(300).optional(),
    languages: idList(LANGUAGE_NAMES, LANGUAGE_NAMES.length, 'languages').optional(),
    lengthNote: text(80).optional(),
    revisionsIncluded: z.number().int().min(0).max(5).optional(),
    sourcePortfolioItemId: objectId.optional().nullable(),
    aiFilledFields: z.array(z.enum(AI_FIELD_NAMES)).max(AI_FIELD_NAMES.length).optional(),
    rights: rightsBody.optional(),
  })
  .refine((c) => c.budgetMin == null || c.budgetMax == null || c.budgetMax >= c.budgetMin, {
    path: ['budgetMax'],
    message: 'Maximum budget must be greater than or equal to minimum budget',
  });

export const campaignStatusBody = z.object({ status: z.enum(CAMPAIGN_STATUS) });

export const brandListQuery = z.object({
  status: z.enum(CAMPAIGN_STATUS).optional(),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const statusListQuery = (statuses) =>
  z.object({
    status: z.enum(statuses).optional(),
    creatorId: objectId.optional(),
    ...pageQuery,
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

/* ---------- Applications & invitations ---------- */
export const applicationBody = z.object({
  proposal: text(3000, 20),
  proposedPrice: money.optional().nullable(),
  // F7: the creator must confirm they read the brief's rights & usage terms.
  acceptedRights: z.literal(true, 'Confirm you’ve read the rights & usage terms'),
  samplePieceIds: z.array(objectId).max(3, 'Pick up to 3 pieces').optional(),
});

export const applicationReviewBody = z.object({ status: z.enum(['accepted', 'rejected']) });

export const invitationBody = z.object({
  creatorId: objectId,
  message: text(2000).optional(),
});

export const invitationRespondBody = z.object({ status: z.enum(['accepted', 'declined']) });

/* ---------- Projects ---------- */
export const projectStatusBody = z.object({ status: z.enum(PROJECT_STATUS) });

export const deliverableParams = z.object({ id: objectId, deliverableId: objectId });

export const deliverableBody = z
  .object({
    mediaUrl: optionalUrl,
    status: z.enum(DELIVERABLE_STATUS).optional(),
  })
  .refine((b) => b.mediaUrl !== undefined || b.status !== undefined, { message: 'Nothing to update' });

/* F6: versions, decisions, messages */
export const versionParams = z.object({ id: objectId, deliverableId: objectId, n: z.coerce.number().int().min(1).max(999) });

export const versionBody = z.object({
  mediaUrl: httpUrl,
  thumbnailUrl: optionalUrl,
  // Required from v2 on (service); v1 defaults to "First version".
  changeNote: text(1000).optional(),
  toolsUsed: idList(TOOL_NAMES, 20, 'tools').optional(),
});

export const decisionBody = z.object({
  decision: z.enum(['approve', 'changes']),
  note: text(2000).optional(),
});

export const messagesQuery = z.object({ after: z.coerce.date().optional() });

export const messageBody = z.object({
  body: text(2000, 1),
  about: z.object({ deliverableId: objectId, versionNumber: z.coerce.number().int().min(1) }).optional(),
});

/* ---------- Verification ---------- */
const evidenceList = z.array(httpUrl).max(5, 'Add at most 5 evidence links');

// Note: there is deliberately no `status` field. Creators can only save (SELF_REPORTED)
// or submit for review (PENDING); VERIFIED/REJECTED come exclusively from reviewers.
export const verificationCreateBody = z
  .object({
    type: z.enum(VERIFICATION_TYPES),
    subject: text(120, 2).optional(),
    portfolioItemId: objectId.optional(),
    description: text(2000).optional(),
    evidenceUrls: evidenceList.default([]),
    submit: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type !== 'portfolio' && !v.subject) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Name the tool or workflow' });
    if (v.type === 'portfolio' && !v.portfolioItemId) ctx.addIssue({ code: 'custom', path: ['portfolioItemId'], message: 'Choose a portfolio piece' });
    if (v.type === 'workflow' && (v.description ?? '').length < 30) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Describe the workflow in at least 30 characters' });
    }
  });

export const verificationUpdateBody = z
  .object({
    subject: text(120, 2).optional(),
    description: text(2000).optional(),
    evidenceUrls: evidenceList.optional(),
    submit: z.boolean().default(false),
  })
  .strict();

export const reviewListQuery = z.object({
  status: z.enum(VERIFICATION_STATUS).default('PENDING'),
  type: z.enum(VERIFICATION_TYPES).optional(),
  ...pageQuery,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewDecisionBody = z
  .object({
    decision: z.enum(['VERIFIED', 'REJECTED']),
    note: text(1000).optional(),
  })
  .refine((b) => b.decision !== 'REJECTED' || (b.note ?? '').length >= 10, {
    path: ['note'],
    message: 'Explain the rejection (at least 10 characters) so the creator can fix it',
  });

/* ---------- Project feedback ---------- */
export const feedbackBody = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: text(1000).optional(),
});

/* ---------- AI brief builder ---------- */
export const briefDraftBody = z.object({
  idea: text(2000, 15).refine((v) => v.split(/\s+/).length >= 3, 'Describe the idea in a few more words'),
  mode: z.enum(['auto', 'template']).default('auto'),
  // Answers to the clarifying questions from a previous draft (sent back with "Rewrite brief").
  answers: z.array(z.object({ id: text(40, 1), question: text(200).optional(), answer: text(120, 1) })).max(3).optional(),
  // "I want something like this": start from a public portfolio piece.
  fromPieceId: objectId.optional(),
});
