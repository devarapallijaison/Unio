import * as approvals from '../services/approvals.service.js';
import * as clients from '../services/clients.service.js';
import { ok } from '../utils/http.js';

export async function listClients(req, res) {
  ok(res, await clients.listClients(req.user));
}
export async function createClient(req, res) {
  ok(res, await clients.createClient(req.user, req.valid.body), 201);
}
export async function updateClient(req, res) {
  ok(res, await clients.updateClient(req.user, req.valid.params.clientId, req.valid.body));
}
export async function archiveClient(req, res) {
  ok(res, await clients.archiveClient(req.user, req.valid.params.clientId));
}

export async function listApprovals(req, res) {
  ok(res, await approvals.listApprovals(req.user, req.valid.query));
}
export async function createApprovalLink(req, res) {
  ok(res, await approvals.createApprovalLink(req.user, req.valid.params.id, req.valid.body), 201);
}

// Public, token-guarded. Responses are never cached and the page never leaks its URL as a referrer.
export async function getApproval(req, res) {
  ok(res, await approvals.getApproval(req.valid.params.token));
}
export async function decideApproval(req, res) {
  ok(res, await approvals.decideApproval(req.valid.params.token, req.valid.body));
}
