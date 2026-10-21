import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { resetDb, signUp, startDb, stopDb } from './helpers.js';
import { env } from '../src/config/env.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const original = { ...env };
const configure = () => {
  env.azureStorageAccount = 'unioteststore';
  env.azureStorageKey = Buffer.from('not-a-real-storage-key-just-test-bytes').toString('base64');
  env.azureStorageContainer = 'media';
  env.azureStoragePublicBase = '';
};
afterEach(() => Object.assign(env, original));

const body = (over = {}) => ({ purpose: 'portfolio', fileName: 'My Reel (final).MP4', contentType: 'video/mp4', size: 5 * 1024 * 1024, ...over });

describe('upload config', () => {
  test('reports disabled without storage settings, enabled with them', async () => {
    const off = await request(app).get('/api/uploads/config');
    assert.equal(off.status, 200);
    assert.equal(off.body.data.enabled, false);
    configure();
    const on = await request(app).get('/api/uploads/config');
    assert.equal(on.body.data.enabled, true);
    assert.ok(on.body.data.purposes.certificate.includes('application/pdf'));
    assert.ok(!JSON.stringify(on.body.data).includes('unioteststore'), 'no storage account details are exposed');
  });
});

describe('POST /uploads/sas', () => {
  test('requires sign-in', async () => {
    configure();
    assert.equal((await request(app).post('/api/uploads/sas').send(body())).status, 401);
  });

  test('is a clear 503 when storage is not configured', async () => {
    const { agent } = await signUp(app, 'creator');
    const res = await agent.post('/api/uploads/sas').send(body());
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'UPLOADS_DISABLED');
  });

  test('returns a 15-minute write-only URL for a per-user, unguessable blob name', async () => {
    configure();
    const { agent, user } = await signUp(app, 'creator');
    const res = await agent.post('/api/uploads/sas').send(body());
    assert.equal(res.status, 200);
    const { uploadUrl, blobUrl, maxSize, expiresAt } = res.body.data;

    const u = new URL(uploadUrl);
    assert.equal(u.protocol, 'https:');
    assert.equal(u.hostname, 'unioteststore.blob.core.windows.net');
    assert.match(u.pathname, new RegExp(`^/media/portfolio/${user._id}/[0-9a-f-]{36}-my-reel-final\\.mp4$`));
    assert.equal(u.searchParams.get('sp'), 'cw', 'create + write only');
    assert.equal(u.searchParams.get('spr'), 'https');
    assert.ok(u.searchParams.get('sig'));
    const minutes = (new Date(u.searchParams.get('se')) - Date.now()) / 60000;
    assert.ok(minutes > 14 && minutes <= 15.1, `expires in ~15 min, got ${minutes}`);
    assert.ok(Math.abs(new Date(expiresAt) - new Date(u.searchParams.get('se'))) < 1000);

    assert.equal(blobUrl, `https://unioteststore.blob.core.windows.net${u.pathname.replace(/^\/media/, '/media')}`);
    assert.ok(!blobUrl.includes('sig='), 'the public URL carries no token');
    assert.equal(maxSize, 200 * 1024 * 1024);

    const other = await agent.post('/api/uploads/sas').send(body());
    assert.notEqual(other.body.data.blobUrl, blobUrl, 'a fresh name every time');
  });

  test('uses the public base (CDN / custom domain) for the saved URL when set', async () => {
    configure();
    env.azureStoragePublicBase = 'https://cdn.unio.example/media/';
    const { agent } = await signUp(app, 'creator');
    const res = await agent.post('/api/uploads/sas').send(body({ purpose: 'avatar', fileName: 'me.png', contentType: 'image/png', size: 1000 }));
    assert.match(res.body.data.blobUrl, /^https:\/\/cdn\.unio\.example\/media\/avatar\//);
    assert.match(res.body.data.uploadUrl, /^https:\/\/unioteststore\.blob\.core\.windows\.net\/media\/avatar\//);
  });

  test('checks type and size per purpose', async () => {
    configure();
    const { agent } = await signUp(app, 'creator');
    const send = (over) => agent.post('/api/uploads/sas').send(body(over));
    // types
    assert.equal((await send({ contentType: 'application/x-msdownload', fileName: 'a.exe' })).status, 400);
    assert.equal((await send({ contentType: 'image/svg+xml', fileName: 'a.svg' })).status, 400, 'svg can carry scripts');
    assert.equal((await send({ contentType: 'text/html', fileName: 'a.html' })).status, 400);
    assert.equal((await send({ purpose: 'avatar', contentType: 'video/mp4' })).status, 400, 'an avatar is an image');
    assert.equal((await send({ purpose: 'portfolio', contentType: 'application/pdf', fileName: 'a.pdf' })).status, 400);
    assert.equal((await send({ purpose: 'certificate', contentType: 'application/pdf', fileName: 'c.pdf', size: 1000 })).status, 200);
    assert.equal((await send({ purpose: 'brandkit', contentType: 'application/pdf', fileName: 'guide.pdf', size: 1000 })).status, 200);
    assert.equal((await send({ purpose: 'evidence', contentType: 'video/quicktime', fileName: 'rec.mov' })).status, 200);
    // sizes
    const MB = 1024 * 1024;
    assert.equal((await send({ contentType: 'image/png', fileName: 'a.png', size: 10 * MB + 1 })).status, 400);
    assert.equal((await send({ contentType: 'image/png', fileName: 'a.png', size: 10 * MB })).status, 200);
    assert.equal((await send({ contentType: 'application/pdf', purpose: 'certificate', fileName: 'a.pdf', size: 10 * MB + 1 })).status, 400);
    assert.equal((await send({ size: 200 * MB + 1 })).status, 400);
    assert.equal((await send({ size: 200 * MB })).status, 200);
    assert.equal((await send({ size: 0 })).status, 400);
    // shape
    assert.equal((await send({ purpose: 'nope' })).status, 400);
    assert.equal((await send({ fileName: '' })).status, 400);
    assert.equal((await send({ userId: 'someone-else' })).status, 400, 'unknown keys are refused');
  });

  test('file names cannot escape their folder', async () => {
    configure();
    const { agent, user } = await signUp(app, 'creator');
    const res = await agent.post('/api/uploads/sas').send(body({ fileName: '../../other/../evil name.png', contentType: 'image/png', size: 1000 }));
    assert.equal(res.status, 200);
    const path = new URL(res.body.data.uploadUrl).pathname;
    assert.match(path, new RegExp(`^/media/portfolio/${user._id}/[0-9a-f-]{36}-[a-z0-9.-]+$`));
    assert.ok(!path.includes('..'));
  });
});

describe('duplicate uploaded files', () => {
  const HASH = 'a'.repeat(64);
  const piece = (over = {}) => ({ title: 'Serum film', mediaType: 'video', mediaUrl: 'https://unioteststore.blob.core.windows.net/media/portfolio/u/a-reel.mp4', ...over });

  test('the same file hash on another creator’s portfolio is refused; your own is fine', async () => {
    const { agent: a } = await signUp(app, 'creator');
    const { agent: b } = await signUp(app, 'creator');
    const first = await a.post('/api/creator/portfolio').send(piece({ contentHash: HASH }));
    assert.equal(first.status, 201);

    const copy = await b.post('/api/creator/portfolio').send(piece({ contentHash: HASH, mediaUrl: 'https://unioteststore.blob.core.windows.net/media/portfolio/u2/b-reel.mp4' }));
    assert.equal(copy.status, 409);
    assert.equal(copy.body.error.code, 'DUPLICATE_FILE');

    const again = await a.post('/api/creator/portfolio').send(piece({ title: 'Same file, other cut', contentHash: HASH }));
    assert.equal(again.status, 201, 'a creator may reuse their own file');

    const other = await b.post('/api/creator/portfolio').send(piece({ contentHash: 'b'.repeat(64) }));
    assert.equal(other.status, 201);
  });

  test('link-only pieces carry no hash; bad hashes are refused; the hash is never public', async () => {
    const { agent, profile } = await signUp(app, 'creator');
    assert.equal((await agent.post('/api/creator/portfolio').send(piece({ contentHash: 'not-a-hash' }))).status, 400);
    const res = await agent.post('/api/creator/portfolio').send(piece({ contentHash: HASH.toUpperCase() }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.contentHash, HASH, 'stored lowercase');
    const pub = (await request(app).get(`/api/creators/${profile._id}`)).body.data;
    assert.ok(!JSON.stringify(pub).includes(HASH));
    assert.equal((await request(app).get(`/api/portfolio/${res.body.data._id}`)).body.data.piece.contentHash, undefined);
  });

  test('swapping the file link without a new hash clears the old hash', async () => {
    const { agent: a } = await signUp(app, 'creator');
    const { agent: b } = await signUp(app, 'creator');
    const made = (await a.post('/api/creator/portfolio').send(piece({ contentHash: HASH }))).body.data;
    const put = await a.put(`/api/creator/portfolio/${made._id}`).send(piece({ mediaUrl: 'https://youtu.be/xyz' }));
    assert.equal(put.status, 200);
    assert.equal(put.body.data.contentHash, undefined);
    // the stale hash no longer blocks another creator
    assert.equal((await b.post('/api/creator/portfolio').send(piece({ contentHash: HASH }))).status, 201);
  });
});
