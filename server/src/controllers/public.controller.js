import { CreatorProfile } from '../models/index.js';
import { applyToCampaign } from '../services/applications.service.js';
import * as campaigns from '../services/campaigns.service.js';
import * as creators from '../services/creators.service.js';
import { ok } from '../utils/http.js';

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
  ok(res, await campaigns.listPublicCampaigns(req.valid.query));
}

export async function listCategories(_req, res) {
  ok(res, await campaigns.listCategories());
}

export async function getCampaign(req, res) {
  const profile =
    req.user?.role === 'creator' ? await CreatorProfile.findOne({ userId: req.user._id }, '_id').lean() : null;
  ok(res, await campaigns.getPublicCampaign(req.valid.params.id, req.user, profile));
}

export async function apply(req, res) {
  ok(res, await applyToCampaign(req.user, req.valid.params.id, req.valid.body), 201);
}
