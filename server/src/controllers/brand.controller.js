import * as applications from '../services/applications.service.js';
import * as campaigns from '../services/campaigns.service.js';
import * as invitations from '../services/invitations.service.js';
import { recommendCreators } from '../services/matching.service.js';
import * as profiles from '../services/profile.service.js';
import * as projects from '../services/projects.service.js';
import { ok } from '../utils/http.js';

export async function getProfile(req, res) {
  ok(res, await profiles.getOwnBrandProfile(req.user));
}

export async function updateProfile(req, res) {
  ok(res, await profiles.upsertBrandProfile(req.user, req.valid.body));
}

export async function listCampaigns(req, res) {
  ok(res, await campaigns.listOwnCampaigns(req.user, req.valid.query));
}

export async function createCampaign(req, res) {
  ok(res, await campaigns.createCampaign(req.user, req.valid.body), 201);
}

export async function getCampaign(req, res) {
  ok(res, await campaigns.requireOwnCampaign(req.user, req.valid.params.id));
}

export async function updateCampaign(req, res) {
  ok(res, await campaigns.updateCampaign(req.user, req.valid.params.id, req.valid.body));
}

export async function setCampaignStatus(req, res) {
  ok(res, await campaigns.setCampaignStatus(req.user, req.valid.params.id, req.valid.body.status));
}

export async function listCampaignApplications(req, res) {
  ok(res, await applications.listCampaignApplications(req.user, req.valid.params.id, req.valid.query));
}

export async function listApplications(req, res) {
  ok(res, await applications.listBrandApplications(req.user, req.valid.query));
}

export async function reviewApplication(req, res) {
  ok(res, await applications.reviewApplication(req.user, req.valid.params.id, req.valid.body.status));
}

export async function recommendations(req, res) {
  ok(res, await recommendCreators(req.user, req.valid.params.id));
}

export async function invite(req, res) {
  ok(res, await invitations.inviteCreator(req.user, req.valid.params.campaignId, req.valid.body), 201);
}

export async function listInvitations(req, res) {
  ok(res, await invitations.listBrandInvitations(req.user, req.valid.query));
}

export async function cancelInvitation(req, res) {
  ok(res, await invitations.cancelInvitation(req.user, req.valid.params.id));
}

export async function listProjects(req, res) {
  ok(res, await projects.listProjects({ brandId: req.user._id }, req.valid.query));
}
