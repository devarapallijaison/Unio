import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { Project, User } from '../src/models/index.js';
import { scoreMatch } from '../src/services/matching.service.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const PROPOSAL = { proposal: 'I can produce two polished vertical ads using AI-assisted product visuals.', proposedPrice: 8000 };

describe('health & errors', () => {
  test('GET /api/health reports ok', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.db, 'connected');
  });

  test('unknown routes use the error envelope', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  test('invalid ObjectId is rejected with 400', async () => {
    const res = await request(app).get('/api/creators/not-an-id');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('auth', () => {
  test('register creator creates user + profile, hashes password, sets cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Example Creator', email: ' Creator@Example.com ', password: 'StrongPass123!', role: 'creator' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, 'creator@example.com');
    assert.equal(res.body.data.user.passwordHash, undefined);
    assert.equal(res.body.data.profile.displayName, 'Example Creator');
    assert.match(res.headers['set-cookie'][0], /unio_session=.+HttpOnly/i);
    const stored = await User.findOne({ email: 'creator@example.com' }).select('+passwordHash').lean();
    assert.notEqual(stored.passwordHash, 'StrongPass123!');
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
  });

  test('register brand creates brand profile', async () => {
    const { profile } = await signUp(app, 'brand', { name: 'Acme Studio' });
    assert.equal(profile.companyName, 'Acme Studio');
  });

  test('duplicate email → 409', async () => {
    await signUp(app, 'creator', { email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Again', email: 'DUP@example.com', password: 'StrongPass123!', role: 'brand' });
    assert.equal(res.status, 409);
  });

  test('invalid registration input → 400 with details', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'x', email: 'bad', password: 'short', role: 'admin' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.length >= 3);
  });

  test('login: generic 401 for wrong password and unknown email', async () => {
    await signUp(app, 'creator', { email: 'login@example.com' });
    const wrong = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'Nope12345' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Nope12345' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrong.body.error.message, unknown.body.error.message);
  });

  test('me / logout lifecycle', async () => {
    const { agent } = await signUp(app, 'brand');
    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.role, 'brand');
    await agent.post('/api/auth/logout').expect(200);
    assert.equal((await agent.get('/api/auth/me')).status, 401);
    assert.equal((await request(app).get('/api/auth/me')).status, 401);
  });
});

describe('roles & ownership', () => {
  test('wrong role → 403, logged out → 401', async () => {
    const { agent: creator } = await signUp(app, 'creator');
    assert.equal((await creator.post('/api/brand/campaigns').send(campaignPayload())).status, 403);
    assert.equal((await request(app).post('/api/brand/campaigns').send(campaignPayload())).status, 401);
  });

  test('brandId comes from session, not body; other brands cannot edit', async () => {
    const { agent: a, user: ua } = await signUp(app, 'brand');
    const { agent: b, user: ub } = await signUp(app, 'brand');
    const created = await a.post('/api/brand/campaigns').send({ ...campaignPayload(), brandId: ub._id });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.brandId, ua._id);

    const id = created.body.data._id;
    assert.equal((await b.put(`/api/brand/campaigns/${id}`).send(campaignPayload({ title: 'Hijacked' }))).status, 404);
    assert.equal((await b.patch(`/api/brand/campaigns/${id}/status`).send({ status: 'closed' })).status, 404);
    assert.equal((await b.get(`/api/brand/campaigns/${id}/applications`)).status, 404);
  });

  test('budgetMax < budgetMin is rejected', async () => {
    const { agent } = await signUp(app, 'brand');
    const res = await agent.post('/api/brand/campaigns').send(campaignPayload({ budgetMin: 9000, budgetMax: 100 }));
    assert.equal(res.status, 400);
  });

  test('portfolio items are owner-scoped', async () => {
    const { agent: c1 } = await signUp(app, 'creator');
    const { agent: c2 } = await signUp(app, 'creator');
    const item = await c1.post('/api/creator/portfolio').send({
      title: 'Cinematic Skincare Ad',
      mediaType: 'video',
      mediaUrl: 'https://media.example.com/ad.mp4',
      tools: ['Kling', 'CapCut'],
      category: 'Beauty',
    });
    assert.equal(item.status, 201);
    const id = item.body.data._id;
    assert.equal((await c2.delete(`/api/creator/portfolio/${id}`)).status, 404);
    assert.equal((await c2.put(`/api/creator/portfolio/${id}`).send({ title: 'Mine now', mediaUrl: 'https://x.example.com/a.jpg' })).status, 404);
    assert.equal((await c1.delete(`/api/creator/portfolio/${id}`)).status, 200);
  });

  test('portfolio rejects non-http media URLs', async () => {
    const { agent } = await signUp(app, 'creator');
    const res = await agent.post('/api/creator/portfolio').send({ title: 'Bad', mediaUrl: 'javascript:alert(1)' });
    assert.equal(res.status, 400);
  });
});

describe('public discovery', () => {
  test('public campaigns list only open campaigns; drafts 404 for public', async () => {
    const { agent } = await signUp(app, 'brand');
    await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Open one' }));
    const draft = await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Draft one', status: 'draft' }));
    const list = await request(app).get('/api/campaigns');
    assert.equal(list.body.data.total, 1);
    assert.equal(list.body.data.items[0].title, 'Open one');
    assert.ok(list.body.data.items[0].brand.companyName);
    assert.equal((await request(app).get(`/api/campaigns/${draft.body.data._id}`)).status, 404);
    // Owner may preview their draft.
    assert.equal((await agent.get(`/api/campaigns/${draft.body.data._id}`)).status, 200);
  });

  test('creator search/filter/paginate in MongoDB and hides private fields', async () => {
    const { agent } = await signUp(app, 'creator', { name: 'Kling Specialist' });
    await agent.put('/api/creator/profile').send({ displayName: 'Kling Specialist', tools: ['Kling'], skills: ['AI Video'], startingPrice: 5000 });
    await signUp(app, 'creator', { name: 'Someone Else' });

    const byTool = await request(app).get('/api/creators?tool=kling');
    assert.equal(byTool.body.data.total, 1);
    const creator = byTool.body.data.items[0];
    assert.equal(creator.userId, undefined);
    assert.equal(creator.email, undefined);

    const paged = await request(app).get('/api/creators?limit=1&page=2');
    assert.equal(paged.body.data.items.length, 1);
    assert.equal(paged.body.data.totalPages, 2);
    assert.equal((await request(app).get('/api/creators?limit=500')).status, 400);
  });
});

describe('application workflow', () => {
  async function setup() {
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
    return { brand, creator, campaign };
  }

  test('apply → duplicate blocked → brand accepts → exactly one project', async () => {
    const { brand, creator, campaign } = await setup();
    const applied = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    assert.equal(applied.status, 201);
    assert.equal(applied.body.data.status, 'pending');

    const dup = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    assert.equal(dup.status, 409);

    const detail = await creator.agent.get(`/api/campaigns/${campaign._id}`);
    assert.equal(detail.body.data.viewer.application.status, 'pending');

    const inbox = await brand.agent.get(`/api/brand/campaigns/${campaign._id}/applications`);
    assert.equal(inbox.body.data.items.length, 1);
    assert.ok(inbox.body.data.items[0].creator.displayName);

    const appId = applied.body.data._id;
    const accepted = await brand.agent.patch(`/api/brand/applications/${appId}/status`).send({ status: 'accepted' });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data.project.deliverables.length, 1);
    assert.equal(accepted.body.data.project.deliverables[0].title, 'Vertical video ×2');

    const again = await brand.agent.patch(`/api/brand/applications/${appId}/status`).send({ status: 'rejected' });
    assert.equal(again.status, 409);
    assert.equal(await Project.countDocuments(), 1);

    assert.equal((await creator.agent.get('/api/creator/projects')).body.data.total, 1);
    assert.equal((await brand.agent.get('/api/brand/projects')).body.data.total, 1);
  });

  test('brand cannot review applications for campaigns it does not own', async () => {
    const { creator, campaign } = await setup();
    const other = await signUp(app, 'brand');
    const applied = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    const res = await other.agent.patch(`/api/brand/applications/${applied.body.data._id}/status`).send({ status: 'accepted' });
    assert.equal(res.status, 404);
  });

  test('cannot apply to closed campaign; brand role cannot apply; withdraw only pending', async () => {
    const { brand, creator, campaign } = await setup();
    assert.equal((await brand.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL)).status, 403);

    const applied = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    const id = applied.body.data._id;
    assert.equal((await creator.agent.patch(`/api/creator/applications/${id}/withdraw`)).status, 200);
    assert.equal((await creator.agent.patch(`/api/creator/applications/${id}/withdraw`)).status, 409);

    await brand.agent.patch(`/api/brand/campaigns/${campaign._id}/status`).send({ status: 'closed' });
    const late = await signUp(app, 'creator');
    const res = await late.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    assert.equal(res.status, 409);
    // Applications stay auditable after closure.
    assert.equal((await brand.agent.get(`/api/brand/campaigns/${campaign._id}/applications`)).body.data.total, 1);
  });

  test('short proposal is rejected', async () => {
    const { creator, campaign } = await setup();
    const res = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send({ proposal: 'hi' });
    assert.equal(res.status, 400);
  });
});

describe('invitation workflow', () => {
  test('invite → duplicate blocked → accept → one project; application acceptance reuses it', async () => {
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;

    const inv = await brand.agent
      .post(`/api/brand/campaigns/${campaign._id}/invitations`)
      .send({ creatorId: creator.profile._id, message: 'We would like to work with you.' });
    assert.equal(inv.status, 201);
    assert.equal(inv.body.data.status, 'pending');

    const dup = await brand.agent.post(`/api/brand/campaigns/${campaign._id}/invitations`).send({ creatorId: creator.profile._id });
    assert.equal(dup.status, 409);

    const list = await creator.agent.get('/api/creator/invitations');
    assert.equal(list.body.data.items[0].brand.companyName, brand.profile.companyName);

    const other = await signUp(app, 'creator');
    assert.equal((await other.agent.patch(`/api/creator/invitations/${inv.body.data._id}/respond`).send({ status: 'accepted' })).status, 404);

    const accepted = await creator.agent.patch(`/api/creator/invitations/${inv.body.data._id}/respond`).send({ status: 'accepted' });
    assert.equal(accepted.status, 200);
    assert.ok(accepted.body.data.project._id);

    // Same pair via application path → still exactly one project.
    const applied = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    await brand.agent.patch(`/api/brand/applications/${applied.body.data._id}/status`).send({ status: 'accepted' });
    assert.equal(await Project.countDocuments(), 1);
  });

  test('cannot invite to another brand\'s campaign; only owner can cancel; re-invite after cancel', async () => {
    const owner = await signUp(app, 'brand');
    const intruder = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const campaign = (await owner.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;

    const hijack = await intruder.agent.post(`/api/brand/campaigns/${campaign._id}/invitations`).send({ creatorId: creator.profile._id });
    assert.equal(hijack.status, 404);

    const inv = (await owner.agent.post(`/api/brand/campaigns/${campaign._id}/invitations`).send({ creatorId: creator.profile._id })).body.data;
    assert.equal((await intruder.agent.patch(`/api/brand/invitations/${inv._id}/cancel`)).status, 404);
    assert.equal((await owner.agent.patch(`/api/brand/invitations/${inv._id}/cancel`)).status, 200);
    assert.equal((await creator.agent.patch(`/api/creator/invitations/${inv._id}/respond`).send({ status: 'accepted' })).status, 409);

    const reinvite = await owner.agent.post(`/api/brand/campaigns/${campaign._id}/invitations`).send({ creatorId: creator.profile._id });
    assert.equal(reinvite.status, 201);
    assert.equal(reinvite.body.data._id, inv._id);
  });
});

describe('projects & deliverables', () => {
  async function activeProject() {
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
    const applied = await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL);
    const { project } = (await brand.agent.patch(`/api/brand/applications/${applied.body.data._id}/status`).send({ status: 'accepted' })).body.data;
    return { brand, creator, project };
  }

  test('participant-only access', async () => {
    const { brand, creator, project } = await activeProject();
    const stranger = await signUp(app, 'brand');
    assert.equal((await brand.agent.get(`/api/projects/${project._id}`)).body.data.viewerRole, 'brand');
    assert.equal((await creator.agent.get(`/api/projects/${project._id}`)).body.data.viewerRole, 'creator');
    assert.equal((await stranger.agent.get(`/api/projects/${project._id}`)).status, 404);
  });

  test('deliverable lifecycle and project transitions', async () => {
    const { brand, creator, project } = await activeProject();
    const d = project.deliverables[0]._id;
    const base = `/api/projects/${project._id}`;

    // Submitting without media fails; brand cannot attach media.
    assert.equal((await creator.agent.patch(`${base}/deliverables/${d}`).send({ status: 'submitted' })).status, 400);
    assert.equal((await brand.agent.patch(`${base}/deliverables/${d}`).send({ mediaUrl: 'https://cdn.example.com/a.mp4' })).status, 403);

    const submitted = await creator.agent
      .patch(`${base}/deliverables/${d}`)
      .send({ mediaUrl: 'https://cdn.example.com/a.mp4', status: 'submitted' });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.project.status, 'in_progress');

    // Creator cannot approve their own work; brand cannot complete before submission.
    assert.equal((await creator.agent.patch(`${base}/deliverables/${d}`).send({ status: 'approved' })).status, 409);
    assert.equal((await brand.agent.patch(`${base}/status`).send({ status: 'completed' })).status, 409);

    await creator.agent.patch(`${base}/status`).send({ status: 'submitted' }).expect(200);
    await brand.agent.patch(`${base}/deliverables/${d}`).send({ status: 'approved' }).expect(200);
    const done = await brand.agent.patch(`${base}/status`).send({ status: 'completed' });
    assert.equal(done.status, 200);
    assert.equal(done.body.data.project.status, 'completed');
    assert.equal((await creator.agent.patch(`${base}/deliverables/${d}`).send({ mediaUrl: '' })).status, 409);
  });
});

describe('matching', () => {
  test('scores skill/tool/category/budget/availability with reasons', () => {
    const campaign = campaignPayload();
    const strong = scoreMatch(campaign, {
      skills: ['ai video', 'Product Advertising'],
      tools: ['Kling', 'Runway'],
      specialties: ['Beauty'],
      startingPrice: 6000,
      availability: 'available',
    });
    assert.equal(strong.score, 100);
    assert.ok(strong.reasons.some((r) => r.includes('Kling')));
    const weak = scoreMatch(campaign, { skills: [], tools: [], specialties: [], startingPrice: 90000, availability: 'unavailable' });
    assert.equal(weak.score, 0);
  });

  test('recommendations endpoint is owner-only', async () => {
    const brand = await signUp(app, 'brand');
    const other = await signUp(app, 'brand');
    await signUp(app, 'creator');
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
    const recs = await brand.agent.get(`/api/brand/campaigns/${campaign._id}/recommendations`);
    assert.equal(recs.status, 200);
    assert.ok(Array.isArray(recs.body.data));
    assert.equal((await other.agent.get(`/api/brand/campaigns/${campaign._id}/recommendations`)).status, 404);
  });
});
