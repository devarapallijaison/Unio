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
