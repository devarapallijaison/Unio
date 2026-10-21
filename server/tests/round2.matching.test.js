import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { CreatorProfile, PortfolioItem } from '../src/models/index.js';
import { WEIGHTS, scoreMatch } from '../src/services/matching.service.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const CAMPAIGN = {
  contentType: 'ad',
  requiredSkills: ['edit', 'prompt'],
  requiredTools: ['Kling', 'Runway'],
  category: 'beauty',
  budgetMin: 5000,
  budgetMax: 15000,
  formats: ['9:16'],
  languages: ['Hindi'],
};

const STRONG = {
  contentTypes: ['ad'],
  skills: ['edit', 'prompt'],
  tools: ['Kling', 'Runway'],
  verifiedTools: ['Kling', 'Runway'],
  specializations: ['beauty'],
  formats: ['9:16'],
  languages: ['Hindi', 'English'],
  startingPrice: 6000,
  trustLevel: 5,
  availability: 'available',
};
const STRONG_EVIDENCE = { skillCounts: { edit: 3, prompt: 2 }, industryCounts: { beauty: 12 } };

const points = (r) => Object.fromEntries(r.breakdown.map((b) => [b.signal, b.points]));

describe('F4 weights and scoring', () => {
  test('weights are one constant that sums to 100; breakdown lists every signal with its max', () => {
    assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
    const r = scoreMatch(CAMPAIGN, STRONG, STRONG_EVIDENCE);
    assert.deepEqual(
      r.breakdown.map((b) => [b.signal, b.max]),
      Object.entries(WEIGHTS),
    );
  });

  test('a creator who fits everything scores 100 with plain reasons', () => {
    const r = scoreMatch(CAMPAIGN, STRONG, STRONG_EVIDENCE);
    assert.equal(r.score, 100);
    assert.deepEqual(r.warnings, []);
    const expected = [
      'Kling and Runway verified',
      '12 beauty & skincare pieces',
      'Rate fits ₹5K–₹15K',
      'Works in Hindi',
      'Video editing and Prompt engineering shown in their work',
      '★ Made on UNIO',
    ];
    for (const reason of expected) assert.ok(r.reasons.includes(reason), `missing reason: ${reason}`);
  });

  test('deterministic partial score: related type, one backed skill, self-reported tool, busy', () => {
    const r = scoreMatch(
      CAMPAIGN,
      {
        contentTypes: ['short'], // same video family as "ad" → half
        skills: ['edit', 'prompt'], // prompt listed but not shown in a piece
        tools: ['Kling'], // self-reported → 0.5; Runway missing → 0
        specializations: ['food'],
        formats: ['16:9'],
        languages: ['English'],
        startingPrice: 18000, // ≤ 1.25 × 15000 → half
        trustLevel: 3,
        availability: 'busy',
      },
      { skillCounts: { edit: 1 } },
    );
    assert.deepEqual(points(r), { contentType: 10, skills: 10, tools: 3.8, industry: 0, budget: 5, trust: 6, format: 0, language: 0, availability: 2 });
    assert.equal(r.score, 37);
    assert.ok(r.warnings.includes('Kling self-reported — counts half'));
    assert.ok(r.warnings.includes('Prompt engineering listed but not shown in a piece yet'));
    assert.ok(r.warnings.includes('Limited availability — lost 3 availability points'));
  });

  test('tool credit: verified 1, certified 0.75, self 0.5; unbacked skills earn nothing', () => {
    const campaign = { requiredTools: ['Kling', 'Runway', 'Veo', 'Flux'], requiredSkills: ['edit'] };
    const r = scoreMatch(campaign, { tools: ['Kling', 'Runway', 'Veo'], verifiedTools: ['Kling'], certifiedTools: ['Runway'], skills: ['edit'] }, {});
    assert.equal(points(r).tools, Math.round(((1 + 0.75 + 0.5 + 0) / 4) * 15 * 10) / 10);
    assert.equal(points(r).skills, 0);
    assert.equal(points(r).language, 5, 'no language asked → full');
    assert.equal(points(r).format, 5, 'no format asked → full');
  });
});

describe('F4 on the API', () => {
  async function setup() {
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    await CreatorProfile.updateOne({ userId: creator.user._id }, { $set: { ...STRONG, verifiedTools: ['Kling'] } });
    const profile = await CreatorProfile.findOne({ userId: creator.user._id }).lean();
    await PortfolioItem.create({
      creatorId: profile._id,
      title: 'Serum ad',
      mediaUrl: 'https://cdn.example.com/a.mp4',
      mediaType: 'video',
      skills: ['edit', 'prompt'],
      industry: 'beauty',
    });
    const campaign = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload({ languages: ['Hindi'] }))).body.data;
    return { brand, creator, campaign, profile };
  }

  test('creators get match + reasons on P4/P5 (and Best match sort); guests do not', async () => {
    const { creator, campaign } = await setup();
    const detail = await creator.agent.get(`/api/campaigns/${campaign._id}`);
    assert.equal(detail.status, 200);
    const match = detail.body.data.campaign.match;
    assert.ok(match.score > 80, `score ${match.score}`);
    assert.ok(match.reasons.includes('Kling verified'));
    assert.ok(match.warnings.includes('Runway self-reported — counts half'));

    const list = await creator.agent.get('/api/campaigns').query({ sort: 'match' });
    assert.equal(list.status, 200);
    assert.equal(list.body.data.items[0].match.score, match.score);

    const guest = await request(app).get(`/api/campaigns/${campaign._id}`);
    assert.equal(guest.body.data.campaign.match, undefined);
    const guestList = await request(app).get('/api/campaigns').query({ sort: 'match' });
    assert.equal(guestList.status, 200, 'match sort falls back to newest for guests');
    assert.equal(guestList.body.data.items[0].match, undefined);
  });

  test('B4 applicants and recommendations carry breakdown/reasons/warnings; unavailable creators are excluded', async () => {
    const { brand, creator, campaign, profile } = await setup();
    await creator.agent
      .post(`/api/campaigns/${campaign._id}/applications`)
      .send({ proposal: 'Two vertical ads with verified Kling motion and a Hindi VO.', acceptedRights: true });
    const apps = await brand.agent.get(`/api/brand/campaigns/${campaign._id}/applications`);
    const m = apps.body.data.items[0].match;
    assert.equal(m.breakdown.length, Object.keys(WEIGHTS).length);
    assert.ok(Array.isArray(m.reasons) && Array.isArray(m.warnings));

    const recs = await brand.agent.get(`/api/brand/campaigns/${campaign._id}/recommendations`);
    assert.equal(recs.body.data[0].creator._id, String(profile._id));
    assert.equal(recs.body.data[0].score, m.score);

    await CreatorProfile.updateOne({ _id: profile._id }, { $set: { availability: 'unavailable' } });
    const later = await brand.agent.get(`/api/brand/campaigns/${campaign._id}/recommendations`);
    assert.ok(!later.body.data.some((r) => r.creator._id === String(profile._id)));
  });
});
