import { z } from 'zod';
import {
  AVAILABILITY,
  CAMPAIGN_STATUS,
  DELIVERABLE_STATUS,
  MEDIA_TYPES,
  PROJECT_STATUS,
  ROLES,
} from '../models/enums.js';
import { httpUrl, money, objectId, optionalUrl, pageQuery, qNumber, qText, tagList, text } from './common.js';

/* ---------- Auth ---------- */
const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address'));
export const registerBody = z.object({
  name: text(120, 2),
  email: emailField,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  role: z.enum(ROLES, 'Choose creator or brand'),
});

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
