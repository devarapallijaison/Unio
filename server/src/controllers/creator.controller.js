import * as applications from '../services/applications.service.js';
import * as invitations from '../services/invitations.service.js';
import * as profiles from '../services/profile.service.js';
import * as projects from '../services/projects.service.js';
import { ok } from '../utils/http.js';

export async function getProfile(req, res) {
  ok(res, await profiles.getOwnCreatorProfile(req.user));
}

export async function updateProfile(req, res) {
  ok(res, await profiles.upsertCreatorProfile(req.user, req.valid.body));
}

export async function listPortfolio(req, res) {
  ok(res, await profiles.listOwnPortfolio(req.user));
}

export async function addPortfolio(req, res) {
  ok(res, await profiles.addPortfolioItem(req.user, req.valid.body), 201);
}

export async function updatePortfolio(req, res) {
  ok(res, await profiles.updatePortfolioItem(req.user, req.valid.params.id, req.valid.body));
}

export async function deletePortfolio(req, res) {
  ok(res, await profiles.deletePortfolioItem(req.user, req.valid.params.id));
}

export async function listApplications(req, res) {
  ok(res, await applications.listCreatorApplications(req.user, req.valid.query));
}

export async function withdrawApplication(req, res) {
  ok(res, await applications.withdrawApplication(req.user, req.valid.params.id));
}

export async function listInvitations(req, res) {
  ok(res, await invitations.listCreatorInvitations(req.user, req.valid.query));
}

export async function respondInvitation(req, res) {
  ok(res, await invitations.respondToInvitation(req.user, req.valid.params.id, req.valid.body.status));
}

export async function listProjects(req, res) {
  const profile = await profiles.requireCreatorProfile(req.user);
  ok(res, await projects.listProjects({ creatorId: profile._id }, req.valid.query, req.user));
}
