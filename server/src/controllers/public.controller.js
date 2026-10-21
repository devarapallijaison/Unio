import { CreatorProfile } from '../models/index.js';
import { applyToCampaign } from '../services/applications.service.js';
import * as campaigns from '../services/campaigns.service.js';
import * as creators from '../services/creators.service.js';
import { matchesForCreator } from '../services/matching.service.js';
import { ok, pageResult, paginate } from '../utils/http.js';

/** Signed-in creator's full profile (for F4 match rings), else null. */
const creatorFor = (req) => (req.user?.role === 'creator' ? CreatorProfile.findOne({ userId: req.user._id }).lean() : null);

export async function listCreators(req, res) {
  ok(res, await creators.listCreators(req.valid.query));
}

export async function getCreator(req, res) {
  ok(res, await creators.getCreator(req.valid.params.id, req.user));
}

export async function getPortfolioPiece(req, res) {
  ok(res, await creators.getPortfolioPiece(req.valid.params.id));
}

export async function listCampaigns(req, res) {
  const q = req.valid.query;
  const creator = await creatorFor(req);
  if (!creator) return ok(res, await campaigns.listPublicCampaigns({ ...q, sort: q.sort === 'match' ? 'newest' : q.sort }));
  if (q.sort === 'match') {
    const all = await campaigns.listPublicCampaigns(q, { all: true });
    const matches = await matchesForCreator(creator, all);
    const ranked = all.map((c, i) => ({ ...c, match: matches[i] })).sort((a, b) => b.match.score - a.match.score);
    const pg = paginate(q);
    return ok(res, pageResult(ranked.slice(pg.skip, pg.skip + pg.limit), ranked.length, pg));
  }
  const page = await campaigns.listPublicCampaigns(q);
  const matches = await matchesForCreator(creator, page.items);
  return ok(res, { ...page, items: page.items.map((c, i) => ({ ...c, match: matches[i] })) });
}

export async function listCategories(_req, res) {
  ok(res, await campaigns.listCategories());
}

export async function getCampaign(req, res) {
  const profile = await creatorFor(req);
  const result = await campaigns.getPublicCampaign(req.valid.params.id, req.user, profile);
  if (profile) [result.campaign.match] = await matchesForCreator(profile, [result.campaign]);
  ok(res, result);
}

export async function apply(req, res) {
  ok(res, await applyToCampaign(req.user, req.valid.params.id, req.valid.body), 201);
}
