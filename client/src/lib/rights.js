import { labelOf } from '../hooks/useTaxonomy.js';

/* Rights & usage (F7) display helpers. Labels come from GET /api/taxonomy (taxonomy.rights). */

const pick = (list, id) => list?.find((o) => o.id === id)?.label;

export const RIGHTS_REQUIRED = ['usage', 'region', 'durationMonths', 'exclusive'];

export function rightsMissing(rights = {}) {
  return RIGHTS_REQUIRED.filter((k) => (k === 'usage' ? !rights.usage?.length : rights[k] == null));
}

/** Rows for the RightsTicket (P5): what the brand can do with the creator's work. */
export function rightsRows(rights = {}, taxonomy) {
  const t = taxonomy?.rights;
  if (!t || rightsMissing(rights).length) return [];
  const portfolio = { yes: 'you may show it in your portfolio', after_launch: 'you may show it in your portfolio after launch', no: 'not in your portfolio' }[rights.portfolioAllowed ?? 'after_launch'];
  return [
    { label: 'Usage', value: rights.usage.map((u) => pick(t.usage, u)).join(' + ') },
    { label: 'Region', value: rights.region === 'custom' ? rights.regionNote || 'Custom region' : pick(t.regions, rights.region) },
    { label: 'Duration', value: rights.durationMonths ? `${rights.durationMonths} months from delivery` : 'Perpetual' },
    { label: 'Exclusive', value: rights.exclusive ? `Yes — ${portfolio}` : `No — ${portfolio}` },
    { label: 'Tools', value: rights.commerciallySafeTools !== false ? 'Commercially-safe licences only' : 'Any tools' },
    { label: 'AI label', value: rights.aiLabel !== false ? 'Required on posts' : 'Not required' },
    { label: 'Likeness', value: { none: 'No real person’s face or voice', ai_only: 'AI-generated people only', real_with_consent: 'Real people, with written consent' }[rights.likeness ?? 'none'] },
  ];
}

/** "2 × Vertical video · 3 × Still frames" */
export function deliverablesSummary(deliverables = []) {
  return deliverables.map((d) => (d.quantity > 1 ? `${d.quantity} × ${d.title}` : d.title)).join(' · ');
}

export function categoryName(taxonomy, id) {
  return labelOf(taxonomy, 'specializations', id);
}
