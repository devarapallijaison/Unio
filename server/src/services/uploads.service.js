import crypto from 'node:crypto';
import { BlobSASPermissions, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters } from '@azure/storage-blob';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Direct browser uploads to Azure Blob Storage (guide §8). Files never pass through Express: the API only
 * hands out a short-lived write-only SAS URL after checking what is being uploaded.
 *
 * Known limit (demo): the container is public-read for blobs, so evidence recordings are readable by anyone
 * who has the unguessable URL. Production upgrade: a private container plus read SAS URLs.
 */

const MB = 1024 * 1024;
export const SAS_MINUTES = 15;

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime'];
const PDF = ['application/pdf'];

/** What each upload purpose accepts. */
export const PURPOSES = {
  portfolio: [...IMAGES, ...VIDEOS],
  version: [...IMAGES, ...VIDEOS],
  evidence: [...IMAGES, ...VIDEOS],
  thumbnail: IMAGES,
  avatar: IMAGES,
  certificate: [...IMAGES, ...PDF],
  brandkit: [...IMAGES, ...PDF],
};
export const PURPOSE_IDS = Object.keys(PURPOSES);

const maxSizeFor = (contentType) => (VIDEOS.includes(contentType) ? 200 * MB : 10 * MB);

export const uploadsEnabled = () => !!(env.azureStorageAccount && env.azureStorageKey && env.azureStorageContainer);

/** What the client may rely on to decide whether to show upload controls. */
export function uploadConfig() {
  return {
    enabled: uploadsEnabled(),
    maxImageBytes: 10 * MB,
    maxVideoBytes: 200 * MB,
    purposes: Object.fromEntries(Object.entries(PURPOSES).map(([k, types]) => [k, types])),
  };
}

/** Safe, readable blob file name: lowercase ascii, no path characters. */
export function slugFileName(name) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : '';
  const slug = base.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return ext ? `${slug}.${ext}` : slug;
}

const publicBase = () => (env.azureStoragePublicBase || `https://${env.azureStorageAccount}.blob.core.windows.net/${env.azureStorageContainer}`).replace(/\/$/, '');

export function createUploadSas(user, { purpose, fileName, contentType, size }) {
  if (!uploadsEnabled()) throw new ApiError(503, 'UPLOADS_DISABLED', 'File uploads are not set up here yet. Paste a link instead.');
  const allowed = PURPOSES[purpose];
  if (!allowed.includes(contentType)) {
    throw ApiError.badRequest('This file type is not allowed here', [{ location: 'body', field: 'contentType', message: `Allowed: ${allowed.join(', ')}` }]);
  }
  const max = maxSizeFor(contentType);
  if (size > max) {
    throw ApiError.badRequest(`That file is too large (max ${max / MB} MB)`, [{ location: 'body', field: 'size', message: `Max ${max / MB} MB for this file type` }]);
  }

  const blobName = `${purpose}/${user._id}/${crypto.randomUUID()}-${slugFileName(fileName)}`;
  const credential = new StorageSharedKeyCredential(env.azureStorageAccount, env.azureStorageKey);
  const startsOn = new Date(Date.now() - 60 * 1000); // tolerate small clock skew
  const expiresOn = new Date(Date.now() + SAS_MINUTES * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName: env.azureStorageContainer,
      blobName,
      permissions: BlobSASPermissions.parse('cw'), // create + write only: no read, delete or list
      protocol: SASProtocol.Https,
      startsOn,
      expiresOn,
    },
    credential,
  ).toString();

  const base = `https://${env.azureStorageAccount}.blob.core.windows.net/${env.azureStorageContainer}/${blobName}`;
  return { uploadUrl: `${base}?${sas}`, blobUrl: `${publicBase()}/${blobName}`, maxSize: max, expiresAt: expiresOn.toISOString() };
}
