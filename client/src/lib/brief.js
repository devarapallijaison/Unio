import { rightsMissing } from './rights.js';

/* The twelve brief fields the B3 meter counts ("N of 12 filled") and B2 quotes for drafts. */

export const BRIEF_FIELDS = ['title', 'category', 'brief', 'contentType', 'formats', 'lengthNote', 'style', 'languages', 'budget', 'deliverables', 'deadline', 'rights'];

const present = {
  formats: (c) => c.formats?.length > 0,
  languages: (c) => c.languages?.length > 0,
  budget: (c) => c.budgetMin != null || c.budgetMax != null,
  deliverables: (c) => c.deliverables?.some((d) => d.title?.trim()),
  rights: (c) => rightsMissing(c.rights).length === 0,
};

export function isFilled(campaign, field) {
  const test = present[field];
  if (test) return Boolean(test(campaign));
  const v = campaign[field];
  return typeof v === 'string' ? v.trim().length > 0 : v != null;
}

export function filledCount(campaign) {
  return BRIEF_FIELDS.filter((f) => isFilled(campaign, f)).length;
}

/** Fields the AI filled that are still untouched, limited to the twelve counted ones. */
export function aiFilledCount(campaign) {
  return (campaign.aiFilledFields ?? []).filter((f) => BRIEF_FIELDS.includes(f)).length;
}
