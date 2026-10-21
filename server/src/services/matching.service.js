import { CreatorProfile } from '../models/index.js';
import { requireOwnCampaign } from './campaigns.service.js';
import { creatorSummary } from './serializers.js';

/**
 * Explainable rule-based match between a campaign and a creator.
 * Weights: skills 40, tools 25, specialty/category 20, budget 10, availability 5.
 * The score is a relevance hint, not a prediction of outcome.
 */
const WEIGHTS = { skills: 40, tools: 25, category: 20, budget: 10, availability: 5 };

const norm = (list = []) => list.map((s) => s.toLowerCase().trim());

function overlap(required, offered) {
  const have = new Set(norm(offered));
  const reqNorm = norm(required);
  return required.filter((_, i) => have.has(reqNorm[i]));
}

export function scoreMatch(campaign, creator) {
  const reasons = [];
  let score = 0;

  const req = campaign.requiredSkills ?? [];
  const skillHits = overlap(req, creator.skills);
  score += req.length ? (skillHits.length / req.length) * WEIGHTS.skills : WEIGHTS.skills / 2;
  if (skillHits.length) reasons.push(`Matches ${skillHits.join(' and ')}`);

  const tools = campaign.requiredTools ?? [];
  const toolHits = overlap(tools, creator.tools);
  score += tools.length ? (toolHits.length / tools.length) * WEIGHTS.tools : WEIGHTS.tools / 2;
  if (toolHits.length) reasons.push(`Uses ${toolHits.join(', ')}`);

  const category = (campaign.category ?? '').toLowerCase();
  // Round 2 campaigns use specialization ids; Round 1 data uses free-text specialties. (Phase 7 replaces this scorer.)
  const specialties = norm([...(creator.specializations ?? []), ...(creator.specialties ?? [])]);
  if (category && specialties.some((s) => s === category || s.includes(category) || category.includes(s))) {
    score += WEIGHTS.category;
    reasons.push(`Specialises in ${campaign.category}`);
  }

  const price = creator.startingPrice;
  if (price != null && campaign.budgetMax != null) {
    if (price <= campaign.budgetMax) {
      score += WEIGHTS.budget;
      reasons.push('Starting price fits the budget');
    } else if (price <= campaign.budgetMax * 1.25) {
      score += WEIGHTS.budget / 2;
    }
  } else {
    score += WEIGHTS.budget / 2;
  }

  if (creator.availability === 'available') {
    score += WEIGHTS.availability;
    reasons.push('Available for projects');
  } else if (creator.availability === 'busy') {
    score += WEIGHTS.availability / 2;
  }

  return { score: Math.round(score), reasons };
}

export async function recommendCreators(user, campaignId, limit = 8) {
  const campaign = await requireOwnCampaign(user, campaignId);
  const creators = await CreatorProfile.find({ availability: { $ne: 'unavailable' } }).limit(500).lean();
  return creators
    .map((c) => ({ creator: creatorSummary(c), ...scoreMatch(campaign, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
