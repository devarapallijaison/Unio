import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { resetDb, signInReviewer, signUp, startDb, stopDb } from './helpers.js';
import { CreatorProfile, VerificationSubmission } from '../src/models/index.js';
import { __setNetworkForTests } from '../src/services/precheck.service.js';
import { sweepExpiredTrust } from '../src/services/trust.service.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);
afterEach(() => __setNetworkForTests(null));

const REC = 'https://drive.google.com/file/d/abc123/view';
const SHOTS = ['https://example.com/shot-1.png', 'https://example.com/shot-2.png'];
const DAY = 24 * 60 * 60 * 1000;

const okFetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, body: { cancel: async () => {} } });
const publicNet = (extra = {}) => __setNetworkForTests({ fetch: okFetch, ...extra });

const challenge = (agent, tool = 'Kling') => agent.post('/api/creator/verifications/challenge').send({ tool });
async function submitted(agent, tool = 'Kling', body = {}) {
  const claim = (await challenge(agent, tool)).body.data;
  const res = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS, ...body });
  return { claim, res };
}
const checkOf = (data, id) => data.checks.find((c) => c.id === id);

describe('challenge code', () => {
  test('issues UNIO-XXXX valid for 48 h, reuses the claim, creators only', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const res = await challenge(agent);
    assert.equal(res.status, 201);
    const c = res.body.data;
    assert.match(c.challengeCode, /^UNIO-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal(c.status, 'SELF_REPORTED');
    assert.equal(c.method, 'challenge');
    const hours = (new Date(c.challengeExpiresAt) - new Date(c.challengeIssuedAt)) / 3600000;
    assert.equal(hours, 48);

    const again = (await challenge(agent)).body.data;
    assert.equal(again._id, c._id, 'one claim per tool');
    assert.notEqual(again.challengeCode, c.challengeCode, 'fresh code each time');

    const { agent: brand } = await signUp(app, 'brand');
    assert.equal((await challenge(brand)).status, 403);
    assert.equal((await request(app).post('/api/creator/verifications/challenge').send({ tool: 'Kling' })).status, 401);
  });

  test('submitting makes the claim PENDING and runs the automatic pre-checks', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent);
    assert.equal(res.status, 200);
    const d = res.body.data;
    assert.equal(d.status, 'PENDING');
    assert.equal(d.recordingUrl, REC);
    assert.equal(d.screenshotUrls.length, 2);
    assert.equal(checkOf(d, 'https').result, 'pass');
    assert.equal(checkOf(d, 'reachable').result, 'pass');
    assert.equal(checkOf(d, 'screenshots').result, 'pass');
    assert.equal(checkOf(d, 'host').result, 'pass');
    assert.equal(checkOf(d, 'duplicate').result, 'pass');
    assert.equal(d.flagged, false);
    assert.ok(d.checks.every((c) => ['pass', 'fail', 'unknown'].includes(c.result)));
  });

  test('a code works once: resubmitting is blocked, and so is reusing it after a rejection', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const { claim } = await submitted(agent);
    const again = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'ALREADY_PENDING');

    await reviewer.patch(`/api/review/verifications/${claim._id}`).send({ decision: 'REJECTED', note: 'Code is not visible in the prompt box' });
    const reuse = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    assert.equal(reuse.status, 409);
    assert.equal(reuse.body.error.code, 'NO_ACTIVE_CHALLENGE');

    const fresh = (await challenge(agent)).body.data;
    assert.equal(fresh.status, 'REJECTED', 'asking for a new code does not change the decision');
    const ok = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'PENDING');
  });

  test('an expired code is refused with CHALLENGE_EXPIRED; a new code fixes it', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const claim = (await challenge(agent)).body.data;
    await VerificationSubmission.updateOne({ _id: claim._id }, { challengeExpiresAt: new Date(Date.now() - 1000) });
    const res = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CHALLENGE_EXPIRED');
    await challenge(agent);
    const ok = await agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    assert.equal(ok.status, 200);
  });

  test('two submissions racing for one code: only one wins', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const claim = (await challenge(agent)).body.data;
    const send = () => agent.post(`/api/creator/verifications/${claim._id}/submit`).send({ recordingUrl: REC, screenshotUrls: SHOTS });
    const results = await Promise.all([send(), send()]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  });

  test('links must be https and the recording is required', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const claim = (await challenge(agent)).body.data;
    const url = `/api/creator/verifications/${claim._id}/submit`;
    assert.equal((await agent.post(url).send({ recordingUrl: 'http://example.com/a', screenshotUrls: SHOTS })).status, 400);
    assert.equal((await agent.post(url).send({ recordingUrl: REC, screenshotUrls: ['http://example.com/a.png'] })).status, 400);
    assert.equal((await agent.post(url).send({ screenshotUrls: SHOTS })).status, 400);
    assert.equal((await agent.post(url).send({ recordingUrl: REC, screenshotUrls: SHOTS, status: 'VERIFIED' })).status, 400);
  });

  test('challenge claims cannot be edited through the old evidence endpoint', async () => {
    const { agent } = await signUp(app, 'creator');
    const claim = (await challenge(agent)).body.data;
    const res = await agent.put(`/api/creator/verifications/${claim._id}`).send({ evidenceUrls: ['https://example.com/x'], submit: true });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'USE_TRUST_FLOW');
  });
});

describe('pre-checks never claim certainty', () => {
  test('fewer than 2 screenshots fails that check but the claim still goes to a reviewer', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent, 'Kling', { screenshotUrls: [SHOTS[0]] });
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(checkOf(res.body.data, 'screenshots').result, 'fail');
  });

  test('a network failure is "unknown", not "fail"', async () => {
    __setNetworkForTests({ fetch: async () => { throw new Error('timeout'); } });
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent);
    assert.equal(checkOf(res.body.data, 'reachable').result, 'unknown');
    assert.equal(checkOf(res.body.data, 'reachable_shot').result, 'unknown');
  });

  test('a host that refuses automated requests is "unknown"', async () => {
    __setNetworkForTests({ fetch: async () => ({ ok: false, status: 403, headers: { get: () => null }, body: null }) });
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent);
    assert.equal(checkOf(res.body.data, 'reachable').result, 'unknown');
  });

  test('links that resolve to private addresses are never fetched', async () => {
    let fetched = 0;
    __setNetworkForTests({ fetch: async (...a) => { fetched += 1; return okFetch(...a); }, lookup: async () => [{ address: '10.0.0.5' }] });
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent, 'Kling', { recordingUrl: 'https://internal.example.com/rec', screenshotUrls: SHOTS });
    assert.equal(checkOf(res.body.data, 'reachable').result, 'fail');
    assert.equal(fetched, 0);
  });

  test('a redirect into a private address is stopped', async () => {
    const seen = [];
    __setNetworkForTests({
      fetch: async (url) => {
        seen.push(url);
        return { ok: false, status: 302, headers: { get: (h) => (h === 'location' ? 'https://metadata.internal/latest' : null) }, body: null };
      },
      lookup: async (host) => [{ address: host === 'metadata.internal' ? '169.254.169.254' : '93.184.216.34' }],
    });
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent);
    assert.equal(checkOf(res.body.data, 'reachable').result, 'fail');
    assert.ok(!seen.includes('https://metadata.internal/latest'));
  });

  test('an unknown recording host is "unknown"', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent, 'Kling', { recordingUrl: 'https://files.somewhere.example/rec.mp4' });
    assert.equal(checkOf(res.body.data, 'host').result, 'unknown');
  });

  test('the optional AI check is labelled as a guess and a failure there is "unknown"', async () => {
    const reply = (text) => ({ messages: { create: async () => ({ content: [{ type: 'text', text }] }) } });
    __setNetworkForTests({ fetch: okFetch, anthropic: reply('{"codeVisible": true, "toolUi": null}') });
    const { agent } = await signUp(app, 'creator');
    const { res } = await submitted(agent);
    assert.equal(checkOf(res.body.data, 'ai_code').result, 'pass');
    assert.match(checkOf(res.body.data, 'ai_code').label, /AI guess/);
    assert.equal(checkOf(res.body.data, 'ai_tool').result, 'unknown');

    __setNetworkForTests({ fetch: okFetch, anthropic: { messages: { create: async () => { throw new Error('boom'); } } } });
    const { agent: b } = await signUp(app, 'creator');
    const { res: res2 } = await submitted(b, 'Runway', { recordingUrl: 'https://youtu.be/xyz' });
    assert.equal(res2.status, 200);
    assert.equal(checkOf(res2.body.data, 'ai_code').result, 'unknown');
  });

  test('the same recording from another creator is flagged for the reviewer', async () => {
    publicNet();
    const { agent: a } = await signUp(app, 'creator');
    const { agent: b } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const first = await submitted(a);
    assert.equal(first.res.body.data.flagged, false);
    const second = await submitted(b);
    assert.equal(second.res.body.data.flagged, true);
    assert.equal(checkOf(second.res.body.data, 'duplicate').result, 'fail');

    const queue = (await reviewer.get('/api/review/verifications?tab=flagged')).body.data;
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0]._id, second.claim._id);
    assert.deepEqual(queue.tabs, { tools: 2, certificates: 0, flagged: 1 });
  });
});

describe('reviewer decisions', () => {
  test('approve sets expiresAt +12 months, recomputes trust and shows Verified publicly', async () => {
    publicNet();
    const { agent, profile } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const { claim } = await submitted(agent);
    const res = await reviewer.patch(`/api/review/verifications/${claim._id}`).send({ decision: 'VERIFIED' });
    assert.equal(res.status, 200);
    const months = (new Date(res.body.data.expiresAt).getFullYear() - new Date().getFullYear()) * 12 + new Date(res.body.data.expiresAt).getMonth() - new Date().getMonth();
    assert.equal(months, 12);
    assert.ok(res.body.data.reviewerId, 'reviewer is logged on the decision');

    const p = await CreatorProfile.findById(profile._id).lean();
    assert.deepEqual(p.verifiedTools, ['Kling']);
    assert.equal(p.trustLevel, 4);

    const { signals } = (await request(app).get(`/api/creators/${profile._id}`)).body.data;
    const kling = signals.tools.find((t) => t.name === 'Kling');
    assert.equal(kling.status, 'VERIFIED');
    assert.equal(kling.code, claim.challengeCode);
    const discover = (await request(app).get('/api/creators?tools=Kling&vonly=1')).body.data;
    assert.equal(discover.total, 1);
  });

  test('reject and ask-for-more both need a reason; ask-for-more returns it to the creator', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const { claim } = await submitted(agent);
    const url = `/api/review/verifications/${claim._id}`;
    assert.equal((await reviewer.patch(url).send({ decision: 'REJECTED' })).status, 400);
    assert.equal((await reviewer.patch(url).send({ decision: 'REJECTED', note: 'too short' })).status, 400);
    assert.equal((await reviewer.patch(url).send({ decision: 'ASK_MORE' })).status, 400);

    const res = await reviewer.patch(url).send({ decision: 'ASK_MORE', note: 'Please show the generation finishing' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'SELF_REPORTED');
    const mine = (await agent.get('/api/creator/verifications')).body.data[0];
    assert.equal(mine.status, 'SELF_REPORTED');
    assert.equal(mine.reviewNote, 'Please show the generation finishing');
    assert.equal(mine.reviewerId, undefined);

    // decided once: a second decision on the same submission is a conflict
    assert.equal((await reviewer.patch(url).send({ decision: 'VERIFIED' })).status, 409);
  });

  test('queue tabs split tools from certificates and count real pending items', async () => {
    publicNet();
    const { agent } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    await submitted(agent);
    await agent.post('/api/creator/verifications').send({
      type: 'certificate', subject: 'Midjourney', submit: true,
      certificate: { issuer: 'Coursera', title: 'Midjourney for designers', verifyUrl: 'https://www.coursera.org/verify/ABC' },
    });
    const tools = (await reviewer.get('/api/review/verifications?tab=tools')).body.data;
    const certs = (await reviewer.get('/api/review/verifications?tab=certificates')).body.data;
    assert.equal(tools.items.length, 1);
    assert.equal(tools.items[0].type, 'tool');
    assert.equal(certs.items.length, 1);
    assert.equal(certs.items[0].type, 'certificate');
    assert.deepEqual(tools.tabs, { tools: 1, certificates: 1, flagged: 0 });
    assert.ok(tools.items[0].challengeCode && tools.items[0].checks.length);
  });
});

describe('certificates', () => {
  const cert = (over = {}) => ({
    type: 'certificate', subject: 'Midjourney', submit: true,
    certificate: { issuer: 'Coursera', title: 'Midjourney for designers', verifyUrl: 'https://www.coursera.org/verify/ABC' },
    ...over,
  });

  test('needs a verify link; submitting runs checks; approval shows Certified and raises trust to level 3', async () => {
    publicNet();
    const { agent, profile } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    assert.equal((await agent.post('/api/creator/verifications').send({ type: 'certificate', subject: 'Midjourney', submit: true })).status, 400);
    assert.equal((await agent.post('/api/creator/verifications').send(cert({ certificate: { issuer: 'Coursera', verifyUrl: 'http://insecure.example.com' } }))).status, 400);

    const res = await agent.post('/api/creator/verifications').send(cert());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(checkOf(res.body.data, 'reachable').result, 'pass');
    assert.equal(checkOf(res.body.data, 'host').result, 'pass');
    assert.equal((await CreatorProfile.findById(profile._id).lean()).trustLevel, 2);

    const dup = await agent.post('/api/creator/verifications').send(cert());
    assert.equal(dup.status, 409);

    await reviewer.patch(`/api/review/verifications/${res.body.data._id}`).send({ decision: 'VERIFIED' });
    const p = await CreatorProfile.findById(profile._id).lean();
    assert.deepEqual(p.certifiedTools, ['Midjourney']);
    assert.deepEqual(p.verifiedTools, []);
    assert.equal(p.trustLevel, 3);
    const { signals } = (await request(app).get(`/api/creators/${profile._id}`)).body.data;
    assert.equal(signals.tools.find((t) => t.name === 'Midjourney').status, 'CERTIFIED');
  });

  test('a saved certificate can be submitted later, and a duplicate verify link from someone else is flagged', async () => {
    publicNet();
    const { agent: a } = await signUp(app, 'creator');
    const { agent: b } = await signUp(app, 'creator');
    await a.post('/api/creator/verifications').send(cert());
    const saved = await b.post('/api/creator/verifications').send(cert({ submit: false }));
    assert.equal(saved.body.data.status, 'SELF_REPORTED');
    const sent = await b.post(`/api/creator/verifications/${saved.body.data._id}/submit`).send({});
    assert.equal(sent.status, 200);
    assert.equal(sent.body.data.status, 'PENDING');
    assert.equal(sent.body.data.flagged, true);
  });
});

describe('12-month expiry', () => {
  async function verifiedKling() {
    publicNet();
    const creator = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const { claim } = await submitted(creator.agent);
    await reviewer.patch(`/api/review/verifications/${claim._id}`).send({ decision: 'VERIFIED' });
    return { ...creator, claim };
  }

  test('an approval that lapsed reads as self-reported everywhere and drops trust', async () => {
    const { agent, profile, claim } = await verifiedKling();
    await VerificationSubmission.updateOne({ _id: claim._id }, { expiresAt: new Date(Date.now() - DAY) });

    const { signals } = (await request(app).get(`/api/creators/${profile._id}`)).body.data;
    assert.equal(signals.tools.find((t) => t.name === 'Kling').status, 'SELF_REPORTED');
    assert.equal(signals.verifiedCount, 0);
    const p = await CreatorProfile.findById(profile._id).lean();
    assert.deepEqual(p.verifiedTools, []);
    assert.equal(p.trustLevel, 1);
    assert.equal((await request(app).get('/api/creators?tools=Kling&vonly=1')).body.data.total, 0);

    const mine = (await agent.get('/api/creator/verifications')).body.data[0];
    assert.equal(mine.expired, true, 'the owner is told it expired');
  });

  test('the sweep removes lapsed approvals without anyone opening the profile', async () => {
    const { profile, claim } = await verifiedKling();
    await VerificationSubmission.updateOne({ _id: claim._id }, { expiresAt: new Date(Date.now() - DAY) });
    assert.equal((await CreatorProfile.findById(profile._id).lean()).verifiedTools.length, 1);
    assert.equal(await sweepExpiredTrust(), 1);
    assert.equal((await CreatorProfile.findById(profile._id).lean()).verifiedTools.length, 0);
  });

  test('inside the last 30 days the creator is warned and may re-verify; earlier they may not', async () => {
    const { agent, claim } = await verifiedKling();
    const early = await challenge(agent);
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'ALREADY_VERIFIED');
    assert.ok((await agent.get('/api/creator/verifications')).body.data[0].expiresInDays > 300);
    assert.equal((await agent.get('/api/creator/verifications')).body.data[0].expiringSoon, false);

    await VerificationSubmission.updateOne({ _id: claim._id }, { expiresAt: new Date(Date.now() + 10 * DAY) });
    const soon = (await agent.get('/api/creator/verifications')).body.data[0];
    assert.equal(soon.expiringSoon, true);
    assert.equal(soon.expiresInDays, 10);
    const again = await challenge(agent);
    assert.equal(again.status, 201);
    assert.equal(again.body.data.status, 'VERIFIED', 'the badge stays until the new submission is sent');
  });
});
