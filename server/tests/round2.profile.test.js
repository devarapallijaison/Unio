import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { resetDb, signInReviewer, signUp, startDb, stopDb } from './helpers.js';
import { CreatorProfile, PortfolioItem } from '../src/models/index.js';
import { trustLevelFor } from '../src/services/trust.service.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const PROFILE = {
  displayName: 'Meera Kulkarni',
  headline: 'AI product ads for beauty & D2C · 9:16 first',
  category: 'video',
  secondaryCategories: ['graphic'],
  contentTypes: ['short', 'ad'],
  specializations: ['beauty', 'd2c'],
  styles: ['real', 'cine'],
  formats: ['9:16', '1:1'],
  languages: ['Hindi', 'Marathi', 'English'],
  skills: ['prompt', 'grade', 'edit'],
  tools: ['Kling', 'Runway', 'CapCut'],
  workflow: ['Midjourney', 'Kling', 'Runway', 'CapCut'],
  howIWork: [{ title: 'Brief call', detail: '15 min, align on hook and claims' }],
  startingPrice: 12000,
  turnaroundDays: 6,
  revisionsIncluded: 2,
  commerciallySafe: true,
};

const PIECE = {
  title: 'Verdant SPF · launch reel',
  mediaType: 'video',
  mediaUrl: 'https://cdn.example.com/spf.mp4',
  contentType: 'ad',
  format: '9:16',
  industry: 'beauty',
  skills: ['prompt', 'grade'],
  styles: ['real'],
  workflow: [
    { tool: 'Midjourney', version: 'v6', generations: 12, note: 'Moodboard' },
    { tool: 'Kling', version: '1.6', generations: 24, note: 'Product reveal shots' },
  ],
  versionsCount: 3,
  timeTakenDays: 4,
  briefSummary: 'Sunscreen that doesn’t feel like sunscreen, 9:16, Hindi VO.',
  deliveredSummary: '3 hooks tested, v3 picked.',
  licence: { licensedTo: 'Verdant Skin Co.' },
};

async function creatorWithProfile() {
  const c = await signUp(app, 'creator');
  const res = await c.agent.put('/api/creator/profile').send(PROFILE);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { ...c, profile: res.body.data };
}

async function verifyTool(agent, tool) {
  const claim = await agent.post('/api/creator/verifications').send({ type: 'tool', subject: tool, evidenceUrls: ['https://example.com/rec'], submit: true });
  assert.equal(claim.status, 201, JSON.stringify(claim.body));
  const reviewer = await signInReviewer(app);
  const decided = await reviewer.agent.patch(`/api/review/verifications/${claim.body.data._id}`).send({ decision: 'VERIFIED' });
  assert.equal(decided.status, 200, JSON.stringify(decided.body));
}

describe('creator profile fields (§5.3)', () => {
  test('saves every Round 2 field and returns owner skill proof counts', async () => {
    const { profile } = await creatorWithProfile();
    for (const k of ['headline', 'category', 'contentTypes', 'specializations', 'styles', 'formats', 'languages', 'workflow', 'turnaroundDays', 'commerciallySafe']) {
      assert.deepEqual(profile[k], PROFILE[k], k);
    }
    assert.equal(profile.howIWork[0].title, 'Brief call');
    assert.deepEqual(profile.skillProof, {}, 'no pieces yet → no proof');
  });

  test('only taxonomy ids are accepted; main category cannot repeat in also-do; also-do max 2', async () => {
    const { agent } = await signUp(app, 'creator');
    const bad = await agent.put('/api/creator/profile').send({ displayName: 'X Creator', skills: ['AI Video'], contentTypes: ['reels'] });
    assert.equal(bad.status, 400);
    const fields = bad.body.error.details.map((d) => d.field);
    assert.ok(fields.some((f) => f.startsWith('skills')));
    assert.ok(fields.some((f) => f.startsWith('contentTypes')));

    const repeat = await agent.put('/api/creator/profile').send({ displayName: 'X Creator', category: 'video', secondaryCategories: ['video'] });
    assert.equal(repeat.status, 400);
    const tooMany = await agent.put('/api/creator/profile').send({ displayName: 'X Creator', secondaryCategories: ['graphic', 'photo', 'ugc'] });
    assert.equal(tooMany.status, 400);
    const unknownTool = await agent.put('/api/creator/profile').send({ displayName: 'X Creator', tools: ['MadeUpAI'] });
    assert.equal(unknownTool.status, 400);
  });

  test('trust fields cannot be set by the client', async () => {
    const { agent, profile } = await creatorWithProfile();
    const res = await agent.put('/api/creator/profile').send({
      ...PROFILE,
      trustLevel: 5,
      verifiedTools: ['Kling'],
      madeOnUnioCount: 9,
      ratingAvg: 5,
      ratingCount: 40,
      featured: true,
      isDemo: true,
    });
    assert.equal(res.status, 200);
    const stored = await CreatorProfile.findById(profile._id).lean();
    assert.equal(stored.trustLevel, 1);
    assert.deepEqual(stored.verifiedTools, []);
    assert.equal(stored.madeOnUnioCount, 0);
    assert.equal(stored.ratingCount, 0);
    assert.equal(stored.featured, false);
    assert.equal(stored.isDemo, false);
  });
});

describe('skills backed by work', () => {
  test('public profile shows only skills proven by a piece, with piece counts', async () => {
    const { agent, profile } = await creatorWithProfile();
    await agent.post('/api/creator/portfolio').send(PIECE);
    await agent.post('/api/creator/portfolio').send({ ...PIECE, title: 'Second piece', skills: ['prompt'] });

    const pub = await request(app).get(`/api/creators/${profile._id}`);
    assert.equal(pub.status, 200);
    const { creator } = pub.body.data;
    assert.deepEqual(creator.backedSkills, [{ id: 'prompt', pieces: 2 }, { id: 'grade', pieces: 1 }]);
    assert.deepEqual(creator.skills, ['prompt', 'grade'], "'edit' has no piece, so it is hidden");

    const own = await agent.get('/api/creator/profile');
    assert.deepEqual(own.body.data.skillProof, { prompt: 2, grade: 1 });
    assert.deepEqual(own.body.data.skills, PROFILE.skills, 'the owner still sees every skill they listed');
  });
});

describe('portfolio "how it was made" (§5.5)', () => {
  test('stores workflow steps, adds workflow tools to the piece, ignores server-only fields', async () => {
    const { agent } = await creatorWithProfile();
    const res = await agent.post('/api/creator/portfolio').send({ ...PIECE, madeOnUnio: true, projectId: '507f1f77bcf86cd799439011' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const item = await PortfolioItem.findById(res.body.data._id).lean();
    assert.equal(item.workflow.length, 2);
    assert.equal(item.workflow[1].generations, 24);
    assert.deepEqual(item.tools, ['Midjourney', 'Kling']);
    assert.equal(item.madeOnUnio, false);
    assert.equal(item.projectId, undefined);
    assert.equal(item.licence.licensedTo, 'Verdant Skin Co.');

    const badStep = await agent.post('/api/creator/portfolio').send({ ...PIECE, workflow: [{ tool: 'NotATool' }] });
    assert.equal(badStep.status, 400);
  });

  test('GET /api/portfolio/:id returns the piece and marks only reviewer-verified tools', async () => {
    const { agent } = await creatorWithProfile();
    const created = await agent.post('/api/creator/portfolio').send(PIECE);
    await verifyTool(agent, 'Kling');

    const res = await request(app).get(`/api/portfolio/${created.body.data._id}`);
    assert.equal(res.status, 200);
    const { piece, creator } = res.body.data;
    assert.deepEqual(piece.workflow.map((s) => [s.tool, s.verified]), [['Midjourney', false], ['Kling', true]]);
    assert.equal(piece.contentHash, undefined);
    assert.equal(creator.displayName, 'Meera Kulkarni');
    assert.deepEqual(creator.verifiedTools, ['Kling']);

    assert.equal((await request(app).get('/api/portfolio/507f1f77bcf86cd799439011')).status, 404);
    assert.equal((await request(app).get('/api/portfolio/nope')).status, 400);
  });

  test('public profile ranks featured, then pieces with a workflow', async () => {
    const { agent, profile } = await creatorWithProfile();
    await agent.post('/api/creator/portfolio').send({ ...PIECE, title: 'Plain piece', workflow: [] });
    await agent.post('/api/creator/portfolio').send({ ...PIECE, title: 'With workflow' });
    const pub = await request(app).get(`/api/creators/${profile._id}`);
    assert.equal(pub.body.data.portfolio[0].title, 'With workflow');
  });
});

describe('trust recompute (trust.service)', () => {
  test('level rule', () => {
    const base = { verifiedTools: [], certifiedTools: [], madeOnUnioCount: 0, hasPending: false };
    assert.equal(trustLevelFor(base), 1);
    assert.equal(trustLevelFor({ ...base, hasPending: true }), 2);
    assert.equal(trustLevelFor({ ...base, certifiedTools: ['Midjourney'] }), 3);
    assert.equal(trustLevelFor({ ...base, verifiedTools: ['Kling'] }), 4);
    assert.equal(trustLevelFor({ ...base, verifiedTools: ['Kling'], madeOnUnioCount: 1 }), 5);
    assert.equal(trustLevelFor({ ...base, madeOnUnioCount: 3 }), 1, 'made on UNIO alone needs a verified tool for level 5');
  });

  test('pending claim → 2, reviewer approval → 4 with verifiedTools, withdrawing → back to 1', async () => {
    const { agent, profile } = await creatorWithProfile();
    const claim = await agent.post('/api/creator/verifications').send({ type: 'tool', subject: 'Runway', evidenceUrls: ['https://example.com/rec'], submit: true });
    let stored = await CreatorProfile.findById(profile._id).lean();
    assert.equal(stored.trustLevel, 2);
    assert.deepEqual(stored.pendingTools, ['Runway']);

    const reviewer = await signInReviewer(app);
    await reviewer.agent.patch(`/api/review/verifications/${claim.body.data._id}`).send({ decision: 'VERIFIED' });
    stored = await CreatorProfile.findById(profile._id).lean();
    assert.equal(stored.trustLevel, 4);
    assert.deepEqual(stored.verifiedTools, ['Runway']);
    assert.deepEqual(stored.pendingTools, []);

    const pub = await request(app).get(`/api/creators/${profile._id}`);
    assert.equal(pub.body.data.creator.trustLevel, 4);
    assert.equal(pub.body.data.creator.ratingAvg, null, 'no reviews → no rating shown');

    await agent.delete(`/api/creator/verifications/${claim.body.data._id}`);
    stored = await CreatorProfile.findById(profile._id).lean();
    assert.equal(stored.trustLevel, 1);
    assert.deepEqual(stored.verifiedTools, []);
  });
});
