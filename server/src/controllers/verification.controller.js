import * as verification from '../services/verification.service.js';
import { ok } from '../utils/http.js';

export async function listOwn(req, res) {
  ok(res, await verification.listOwn(req.user));
}

export async function create(req, res) {
  ok(res, await verification.create(req.user, req.valid.body), 201);
}

export async function challenge(req, res) {
  ok(res, await verification.issueChallenge(req.user, req.valid.body), 201);
}

export async function submit(req, res) {
  ok(res, await verification.submit(req.user, req.valid.params.id, req.valid.body));
}

export async function update(req, res) {
  ok(res, await verification.update(req.user, req.valid.params.id, req.valid.body));
}

export async function remove(req, res) {
  ok(res, await verification.remove(req.user, req.valid.params.id));
}

export async function listForReview(req, res) {
  ok(res, await verification.listForReview(req.valid.query));
}

export async function decide(req, res) {
  ok(res, await verification.decide(req.user, req.valid.params.id, req.valid.body));
}
