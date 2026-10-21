import * as uploads from '../services/uploads.service.js';
import { ok } from '../utils/http.js';

export function config(_req, res) {
  ok(res, uploads.uploadConfig());
}

export function sas(req, res) {
  ok(res, uploads.createUploadSas(req.user, req.valid.body));
}
