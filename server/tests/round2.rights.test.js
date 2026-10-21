import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { Application } from '../src/models/index.js';
import { toSpecialization } from '../src/services/briefBuilder.service.js';
import { missingRights, rightsSummary } from '../src/services/serializers.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const NO_RIGHTS = { rights: {} };

describe('rightsSummary()', () => {
  test('one line from the rights answers; null while incomplete', () => {
    assert.equal(rightsSummary({ usage: ['paid_ads'], region: 'india', durationMonths: 6, exclusive: false }), 'Paid ads · India · 6 months · Non-exclusive');
    assert.equal(
      rightsSummary({ usage: ['website', 'paid_ads'], region: 'worldwide', durationMonths: 12, exclusive: true }),
      'Website + Paid ads · Worldwide · 12 months · Exclusive',
    );
    assert.equal(rightsSummary({ usage: ['print'], region: 'custom', regionNote: 'South Asia', durationMonths: 0, exclusive: false }), 'Print · South Asia · Perpetual · Non-exclusive');
    assert.equal(rightsSummary({ usage: ['paid_ads'], region: 'india' }), null);
    assert.deepEqual(missingRights({}), ['usage', 'region', 'durationMonths', 'exclusive']);
    assert.deepEqual(missingRights({ usage: ['paid_ads'], region: 'india', durationMonths: 0, exclusive: false }), [], '0 = perpetual is an answer');
  });
});

describe('Round 1 category migration mapping', () => {
  test('known free-text categories map to specialization ids; unknown stay for the brand', () => {
    const cases = { Beauty: 'beauty', 'Food & Beverage': 'food', Electronics: 'tech', Tech: 'tech', Wellness: 'd2c', Lifestyle: 'd2c', Hospitality: 'd2c', D2C: 'd2c', food: 'food', 'Kids & family': 'kids', Automotive: null };
    for (const [from, to] of Object.entries(cases)) assert.equal(toSpecialization(from), to, from);
  });
});

describe('a campaign cannot open without rights (F7)', () => {
  test('create as open without rights → 409 RIGHTS_REQUIRED listing the missing answers; draft is fine', async () => {
    const { agent } = await signUp(app, 'brand');
    const open = await agent.post('/api/brand/campaigns').send(campaignPayload({ ...NO_RIGHTS, status: 'open' }));
    assert.equal(open.status, 409);
    assert.equal(open.body.error.code, 'RIGHTS_REQUIRED');
    assert.deepEqual(open.body.error.details.map((d) => d.field), ['rights.usage', 'rights.region', 'rights.durationMonths', 'rights.exclusive']);

    const draft = await agent.post('/api/brand/campaigns').send(campaignPayload({ ...NO_RIGHTS, status: 'draft' }));
    assert.equal(draft.status, 201);
    assert.equal(draft.body.data.rightsComplete, false);
    assert.equal(draft.body.data.rightsSummary, null);
  });

  test('opening a draft (status endpoint or update) needs rights; adding them unlocks it', async () => {
    const { agent } = await signUp(app, 'brand');
    const draft = (await agent.post('/api/brand/campaigns').send(campaignPayload({ rights: { usage: ['paid_ads'] }, status: 'draft' }))).body.data;
    const viaStatus = await agent.patch(`/api/brand/campaigns/${draft._id}/status`).send({ status: 'open' });
    assert.equal(viaStatus.status, 409);
    assert.equal(viaStatus.body.error.code, 'RIGHTS_REQUIRED');
    const viaUpdate = await agent.put(`/api/brand/campaigns/${draft._id}`).send(campaignPayload({ rights: { usage: ['paid_ads'] }, status: 'open' }));
    assert.equal(viaUpdate.status, 409);

    const fixed = await agent.put(`/api/brand/campaigns/${draft._id}`).send(campaignPayload({ status: 'draft' }));
    assert.equal(fixed.status, 200);
    const opened = await agent.patch(`/api/brand/campaigns/${draft._id}/status`).send({ status: 'open' });
    assert.equal(opened.status, 200);
    assert.equal(opened.body.data.rightsSummary, 'Paid ads + Organic social · India · 6 months · Non-exclusive');
  });

  test('rights values are validated against the lists', async () => {
    const { agent } = await signUp(app, 'brand');
    for (const rights of [{ usage: ['billboards'] }, { region: 'mars' }, { durationMonths: 5 }, { likeness: 'clone' }]) {
      const res = await agent.post('/api/brand/campaigns').send(campaignPayload({ rights, status: 'draft' }));
      assert.equal(res.status, 400, JSON.stringify(rights));
    }
    const legacyCategory = await agent.post('/api/brand/campaigns').send(campaignPayload({ category: 'Beauty' }));
    assert.equal(legacyCategory.status, 400, 'category is a specialization id now');
  });

  test('public and brand lists carry rightsSummary; brand list has status counts', async () => {
    const { agent } = await signUp(app, 'brand');
    const live = (await agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
    await agent.post('/api/brand/campaigns').send(campaignPayload({ ...NO_RIGHTS, title: 'Unfinished brief', status: 'draft' }));
    const pub = await request(app).get('/api/campaigns');
    assert.equal(pub.body.data.items[0].rightsSummary, 'Paid ads + Organic social · India · 6 months · Non-exclusive');
    const detail = await request(app).get(`/api/campaigns/${live._id}`);
    assert.equal(detail.body.data.campaign.applicantCount, 0);
    assert.equal(detail.body.data.campaign.rights.region, 'india');
    const mine = await agent.get('/api/brand/campaigns');
    assert.deepEqual(mine.body.data.statusCounts, { draft: 1, open: 1, closed: 0 });
    assert.equal(mine.body.data.items.find((c) => c.status === 'draft').rightsComplete, false);
  });

  test('P4 chip filters: content-type groups and exclusive only', async () => {
    const { agent } = await signUp(app, 'brand');
    await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Video brief', contentType: 'ad' }));
    await agent.post('/api/brand/campaigns').send(
      campaignPayload({ title: 'Stills brief', contentType: 'photo', rights: { usage: ['print'], region: 'worldwide', durationMonths: 12, exclusive: true } }),
    );
    const titles = async (qs) => (await request(app).get(`/api/campaigns${qs}`)).body.data.items.map((c) => c.title).sort();
    assert.deepEqual(await titles('?group=video'), ['Video brief']);
    assert.deepEqual(await titles('?group=images,video'), ['Stills brief', 'Video brief']);
    assert.deepEqual(await titles('?exclusive=1'), ['Stills brief']);
  });
});

describe('applying needs the rights checkbox (F7)', () => {
  async function openCampaign() {
    const brand = await signUp(app, 'brand');
    return (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
  }

  test('without acceptedRights → 400; with it the acceptance time is recorded', async () => {
    const campaign = await openCampaign();
    const { agent } = await signUp(app, 'creator');
    const body = { proposal: 'Two vertical ads with three hooks, Hindi voice-over in-house.' };
    const missing = await agent.post(`/api/campaigns/${campaign._id}/applications`).send(body);
    assert.equal(missing.status, 400);
    assert.ok(missing.body.error.details.some((d) => d.field === 'acceptedRights'));
    const ok = await agent.post(`/api/campaigns/${campaign._id}/applications`).send({ ...body, acceptedRights: true });
    assert.equal(ok.status, 201);
    assert.ok((await Application.findById(ok.body.data._id).lean()).rightsAcceptedAt);
  });

  test('relevant work must be the applicant’s own pieces (max 3)', async () => {
    const campaign = await openCampaign();
    const me = await signUp(app, 'creator');
    const other = await signUp(app, 'creator');
    const piece = (b) => b.agent.post('/api/creator/portfolio').send({ title: 'Sample piece', mediaType: 'image', mediaUrl: 'https://cdn.example.com/a.jpg' });
    const mine = (await piece(me)).body.data;
    const theirs = (await piece(other)).body.data;
    const body = { proposal: 'Two vertical ads with three hooks, Hindi voice-over in-house.', acceptedRights: true };
    const bad = await me.agent.post(`/api/campaigns/${campaign._id}/applications`).send({ ...body, samplePieceIds: [mine._id, theirs._id] });
    assert.equal(bad.status, 400);
    const good = await me.agent.post(`/api/campaigns/${campaign._id}/applications`).send({ ...body, samplePieceIds: [mine._id] });
    assert.equal(good.status, 201);
    assert.deepEqual(good.body.data.samplePieceIds.map(String), [mine._id]);
  });
});
