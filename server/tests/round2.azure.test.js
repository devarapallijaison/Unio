import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { signUp, startDb, stopDb } from './helpers.js';

/* Guide §12: one App Service serves the React build + /api; same-origin Lax cookie; CSP. */

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);

describe('Express serves the React build (Azure)', () => {
  test('SPA fallback for client routes, hashed assets cached, /api stays JSON', async () => {
    const { createApp } = await import('../src/app.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unio-public-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>UNIO</title><div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'assets', 'index-abc123.js'), 'console.log(1)');
    const web = createApp({ publicDir: dir });

    const page = await request(web).get('/campaigns/123');
    assert.equal(page.status, 200);
    assert.match(page.text, /<div id="root">/);
    assert.match(page.headers['content-security-policy'], /connect-src 'self' https:\/\/\*\.blob\.core\.windows\.net/);

    const asset = await request(web).get('/assets/index-abc123.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers['cache-control'], /max-age=31536000.*immutable/);

    const api = await request(web).get('/api/nope');
    assert.equal(api.status, 404);
    assert.equal(api.body.success, false, 'API 404s are JSON, never index.html');
    assert.equal((await request(web).get('/api')).status, 404);
  });

  test('without a build the fallback passes through to the JSON 404', async () => {
    const res = await request(app).get('/some/client/route');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  test('session cookie is HttpOnly and SameSite=Lax (same origin)', async () => {
    const agent = request.agent(app);
    const { body } = await signUp(app, 'creator');
    const res = await agent.post('/api/auth/login').send({ email: body.email, password: body.password });
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  });
});
