import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { campaignPayload, resetDb, signInReviewer, signUp, startDb, stopDb } from './helpers.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const EVIDENCE = ['https://example.com/process-video', 'https://example.com/project-file'];
const tool = (overrides = {}) => ({ type: 'tool', subject: 'Kling', evidenceUrls: EVIDENCE, submit: true, ...overrides });

async function addPortfolio(agent, title = 'Serum film') {
  const res = await agent.post('/api/creator/portfolio').send({ title, mediaType: 'video', mediaUrl: 'https://cdn.example.com/a.mp4' });
  return res.body.data;
}

describe('verification permissions', () => {
  test('reviewer role cannot be self-registered', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@example.com', password: 'StrongPass123!', role: 'reviewer' });
    assert.equal(res.status, 400);
  });

  test('creators cannot set status: VERIFIED in the body is rejected', async () => {
    const { agent } = await signUp(app, 'creator');
    const res = await agent.post('/api/creator/verifications').send({ ...tool(), status: 'VERIFIED' });
    assert.equal(res.status, 400);
    const created = await agent.post('/api/creator/verifications').send(tool());
    const upd = await agent.put(`/api/creator/verifications/${created.body.data._id}`).send({ status: 'VERIFIED' });
    assert.equal(upd.status, 400);
  });

  test('only reviewers can list or decide; creators and brands get 403, guests 401', async () => {
    const { agent: creator } = await signUp(app, 'creator');
    const { agent: brand } = await signUp(app, 'brand');
    const sub = (await creator.post('/api/creator/verifications').send(tool())).body.data;
    for (const agent of [creator, brand]) {
      assert.equal((await agent.get('/api/review/verifications')).status, 403);
      assert.equal((await agent.patch(`/api/review/verifications/${sub._id}`).send({ decision: 'VERIFIED' })).status, 403);
    }
    assert.equal((await request(app).get('/api/review/verifications')).status, 401);
  });

  test('brands and reviewers cannot use creator verification endpoints', async () => {
    const { agent: brand } = await signUp(app, 'brand');
    const { agent: reviewer } = await signInReviewer(app);
    assert.equal((await brand.post('/api/creator/verifications').send(tool())).status, 403);
    assert.equal((await reviewer.post('/api/creator/verifications').send(tool())).status, 403);
  });
});

describe('verification lifecycle', () => {
  test('self-report, submit (needs evidence), reviewer verifies, then locked', async () => {
    const { agent } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);

    const selfReported = await agent.post('/api/creator/verifications').send({ type: 'tool', subject: 'Runway' });
    assert.equal(selfReported.status, 201);
    assert.equal(selfReported.body.data.status, 'SELF_REPORTED');

    const noEvidence = await agent.put(`/api/creator/verifications/${selfReported.body.data._id}`).send({ submit: true });
    assert.equal(noEvidence.status, 400);

    const pending = await agent
      .put(`/api/creator/verifications/${selfReported.body.data._id}`)
      .send({ evidenceUrls: EVIDENCE, submit: true });
    assert.equal(pending.body.data.status, 'PENDING');

    const dup = await agent.post('/api/creator/verifications').send({ type: 'tool', subject: ' runway ' });
    assert.equal(dup.status, 409);

    const queue = await reviewer.get('/api/review/verifications');
    assert.equal(queue.body.data.total, 1);
    assert.ok(queue.body.data.items[0].creator.displayName);
    assert.equal(queue.body.data.counts.PENDING, 1);

    const id = pending.body.data._id;
    const verified = await reviewer.patch(`/api/review/verifications/${id}`).send({ decision: 'VERIFIED', note: 'Process video matches' });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.status, 'VERIFIED');

    assert.equal((await reviewer.patch(`/api/review/verifications/${id}`).send({ decision: 'REJECTED', note: 'changed my mind' })).status, 409);
    const locked = await agent.put(`/api/creator/verifications/${id}`).send({ evidenceUrls: ['https://example.com/other'], submit: true });
    assert.equal(locked.status, 409);

    const own = await agent.get('/api/creator/verifications');
    assert.equal(own.body.data[0].reviewerId, undefined, 'reviewer identity is not exposed to creators');
  });

  test('rejection needs a note; creator can fix and resubmit', async () => {
    const { agent } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const sub = (await agent.post('/api/creator/verifications').send(tool())).body.data;

    assert.equal((await reviewer.patch(`/api/review/verifications/${sub._id}`).send({ decision: 'REJECTED' })).status, 400);
    const rejected = await reviewer
      .patch(`/api/review/verifications/${sub._id}`)
      .send({ decision: 'REJECTED', note: 'Links do not show Kling usage' });
    assert.equal(rejected.body.data.status, 'REJECTED');

    const mine = (await agent.get('/api/creator/verifications')).body.data[0];
    assert.equal(mine.reviewNote, 'Links do not show Kling usage');

    const resubmitted = await agent
      .put(`/api/creator/verifications/${sub._id}`)
      .send({ evidenceUrls: ['https://example.com/kling-project'], submit: true });
    assert.equal(resubmitted.body.data.status, 'PENDING');
    assert.equal(resubmitted.body.data.reviewNote, '');
  });

  test('workflow claims require a real description', async () => {
    const { agent } = await signUp(app, 'creator');
    const short = await agent.post('/api/creator/verifications').send({ type: 'workflow', subject: 'Storyboard to video', description: 'short' });
    assert.equal(short.status, 400);
    const created = await agent.post('/api/creator/verifications').send({
      type: 'workflow',
      subject: 'Storyboard to video',
      description: 'Hand-drawn boards, Midjourney keyframes, Kling image-to-video, edit and sound in CapCut.',
      evidenceUrls: EVIDENCE,
      submit: true,
    });
    assert.equal(created.status, 201);
  });
});

describe('portfolio evidence', () => {
  test('cannot claim another creator piece; media change re-opens review; delete removes claim', async () => {
    const owner = await signUp(app, 'creator');
    const other = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    const item = await addPortfolio(owner.agent);

    const steal = await other.agent
      .post('/api/creator/verifications')
      .send({ type: 'portfolio', portfolioItemId: item._id, evidenceUrls: EVIDENCE, submit: true });
    assert.equal(steal.status, 404);

    const sub = (
      await owner.agent
        .post('/api/creator/verifications')
        .send({ type: 'portfolio', portfolioItemId: item._id, evidenceUrls: EVIDENCE, submit: true })
    ).body.data;
    assert.equal(sub.subject, 'Serum film');
    await reviewer.patch(`/api/review/verifications/${sub._id}`).send({ decision: 'VERIFIED' }).expect(200);

    let profile = (await request(app).get(`/api/creators/${owner.profile._id}`)).body.data;
    assert.equal(profile.signals.portfolio[item._id], 'VERIFIED');

    await owner.agent.put(`/api/creator/portfolio/${item._id}`).send({ title: 'Serum film', mediaUrl: 'https://cdn.example.com/b.mp4' }).expect(200);
    profile = (await request(app).get(`/api/creators/${owner.profile._id}`)).body.data;
    assert.equal(profile.signals.portfolio[item._id], 'PENDING');

    await owner.agent.delete(`/api/creator/portfolio/${item._id}`).expect(200);
    assert.equal((await owner.agent.get('/api/creator/verifications')).body.data.length, 0);
  });
});

describe('public signals', () => {
  test('profile shows honest statuses; rejected reads as self-reported; counts are real', async () => {
    const { agent, profile } = await signUp(app, 'creator');
    const { agent: reviewer } = await signInReviewer(app);
    await agent.put('/api/creator/profile').send({ displayName: 'Signal Tester', tools: ['Kling', 'Runway', 'Suno'] });

    const kling = (await agent.post('/api/creator/verifications').send(tool())).body.data;
    const runway = (await agent.post('/api/creator/verifications').send(tool({ subject: 'Runway' }))).body.data;
    await agent.post('/api/creator/verifications').send(tool({ subject: 'Pika' }));
    await reviewer.patch(`/api/review/verifications/${kling._id}`).send({ decision: 'VERIFIED' });
    await reviewer.patch(`/api/review/verifications/${runway._id}`).send({ decision: 'REJECTED', note: 'Evidence link is private' });

    const { signals } = (await request(app).get(`/api/creators/${profile._id}`)).body.data;
    const status = Object.fromEntries(signals.tools.map((t) => [t.name, t.status]));
    assert.deepEqual(status, { Kling: 'VERIFIED', Runway: 'SELF_REPORTED', Suno: 'SELF_REPORTED', Pika: 'PENDING' });
    assert.equal(signals.verifiedCount, 1);
    assert.equal(signals.completedProjects, 0);
    assert.deepEqual(signals.feedback, []);

    const card = (await request(app).get('/api/creators?search=Signal')).body.data.items[0];
    assert.equal(card.verifiedCount, 1);
    assert.equal(card.completedProjects, 0);
  });
});

describe('project feedback', () => {
  test('only the brand, only after completion, only once; then visible on the profile', async () => {
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload({ deliverables: [{ title: 'Film', quantity: 1 }] })))
      .body.data;
    const appRes = await creator.agent
      .post(`/api/campaigns/${campaign._id}/applications`)
      .send({ proposal: 'A considered proposal for this summer brief.' });
    const { project } = (await brand.agent.patch(`/api/brand/applications/${appRes.body.data._id}/status`).send({ status: 'accepted' })).body.data;
    const base = `/api/projects/${project._id}`;

    assert.equal((await brand.agent.post(`${base}/feedback`).send({ rating: 5 })).status, 409, 'not completed yet');
    assert.equal((await creator.agent.post(`${base}/feedback`).send({ rating: 5 })).status, 403, 'creators cannot review themselves');

    const d = project.deliverables[0]._id;
    await creator.agent.patch(`${base}/deliverables/${d}`).send({ mediaUrl: 'https://cdn.example.com/final.mp4', status: 'submitted' }).expect(200);
    await creator.agent.patch(`${base}/status`).send({ status: 'submitted' }).expect(200);
    await brand.agent.patch(`${base}/deliverables/${d}`).send({ status: 'approved' }).expect(200);
    await brand.agent.patch(`${base}/status`).send({ status: 'completed' }).expect(200);

    assert.equal((await brand.agent.post(`${base}/feedback`).send({ rating: 7 })).status, 400);
    const fb = await brand.agent.post(`${base}/feedback`).send({ rating: 5, comment: 'Clear process, on time.' });
    assert.equal(fb.status, 201);
    assert.equal((await brand.agent.post(`${base}/feedback`).send({ rating: 4 })).status, 409);

    const { signals } = (await request(app).get(`/api/creators/${creator.profile._id}`)).body.data;
    assert.equal(signals.completedProjects, 1);
    assert.equal(signals.feedback.length, 1);
    assert.equal(signals.feedback[0].rating, 5);
    assert.equal(signals.feedback[0].brandName, brand.profile.companyName);
  });
});
