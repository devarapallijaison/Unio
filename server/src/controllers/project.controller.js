import * as projects from '../services/projects.service.js';
import { ok } from '../utils/http.js';

export async function getProject(req, res) {
  ok(res, await projects.getProject(req.user, req.valid.params.id));
}

export async function updateStatus(req, res) {
  ok(res, await projects.updateProjectStatus(req.user, req.valid.params.id, req.valid.body.status));
}

export async function updateDeliverable(req, res) {
  const { id, deliverableId } = req.valid.params;
  ok(res, await projects.updateDeliverable(req.user, id, deliverableId, req.valid.body));
}

export async function addFeedback(req, res) {
  ok(res, await projects.addFeedback(req.user, req.valid.params.id, req.valid.body), 201);
}

export async function submitVersion(req, res) {
  const { id, deliverableId } = req.valid.params;
  ok(res, await projects.submitVersion(req.user, id, deliverableId, req.valid.body), 201);
}

export async function decideVersion(req, res) {
  const { id, deliverableId, n } = req.valid.params;
  ok(res, await projects.decideVersion(req.user, id, deliverableId, n, req.valid.body));
}

export async function listMessages(req, res) {
  ok(res, await projects.listMessages(req.user, req.valid.params.id, req.valid.query));
}

export async function postMessage(req, res) {
  ok(res, await projects.postMessage(req.user, req.valid.params.id, req.valid.body), 201);
}

export async function markRead(req, res) {
  ok(res, await projects.markRead(req.user, req.valid.params.id));
}

export async function rightsCard(req, res) {
  ok(res, await projects.getRightsCard(req.user, req.valid.params.id));
}

export async function unread(req, res) {
  ok(res, await projects.unreadForUser(req.user));
}
