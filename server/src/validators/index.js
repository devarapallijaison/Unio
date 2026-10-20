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
import { CATEGORY_IDS, SPECIALIZATION_IDS, TEAM_SIZE_IDS } from '../models/taxonomy.js';
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
export const creatorListQuery = z.object({
  search: qText,
  skill: qText,
  tool: qText,
  specialty: qText,
  availability: z.enum(AVAILABILITY).optional().or(z.literal('').transform(() => undefined)),
  minPrice: qNumber,
  maxPrice: qNumber,
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc']).default('featured'),
  ...pageQuery,
});

export const campaignListQuery = z.object({
  search: qText,
  category: qText,
  skill: qText,
  tool: qText,
  minBudget: qNumber,
  maxBudget: qNumber,
  sort: z.enum(['newest', 'deadline', 'budget_desc']).default('newest'),
  ...pageQuery,
});

/* ---------- Creator profile & portfolio ---------- */
export const creatorProfileBody = z.object({
  displayName: text(120, 2),
  bio: text(2000).optional(),
  photoUrl: optionalUrl,
  location: text(120).optional(),
  skills: tagList.optional(),
  tools: tagList.optional(),
  specialties: tagList.optional(),
  startingPrice: money.optional().nullable(),
  availability: z.enum(AVAILABILITY).optional(),
});

export const portfolioBody = z.object({
  title: text(160, 2),
  description: text(1000).optional(),
  mediaType: z.enum(MEDIA_TYPES).default('image'),
  mediaUrl: httpUrl,
  thumbnailUrl: optionalUrl,
  tools: tagList.optional(),
  category: text(80).optional(),
  featured: z.boolean().optional(),
});

/* ---------- Brand profile & campaigns ---------- */
export const brandProfileBody = z.object({
  companyName: text(160, 2),
  logoUrl: optionalUrl,
  websiteUrl: optionalUrl,
  industry: text(80).optional(),
  description: text(2000).optional(),
});

const deliverableSpec = z.object({
  title: text(160, 1),
  description: text(1000).optional(),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

export const campaignBody = z
  .object({
    title: text(160, 4),
    brief: text(5000, 20),
    category: text(80, 2),
    budgetMin: money.optional().nullable(),
    budgetMax: money.optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    requiredSkills: tagList.optional(),
    requiredTools: tagList.optional(),
    deliverables: z.array(deliverableSpec).max(20).optional(),
    status: z.enum(CAMPAIGN_STATUS).default('draft'),
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
});
