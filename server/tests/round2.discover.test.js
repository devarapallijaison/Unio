import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { resetDb, signUp, startDb, stopDb } from './helpers.js';
import { CreatorProfile } from '../src/models/index.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

/**
 * Fixture creators. Trust fields are normally written only by trust.service; here they are set
 * directly so the tests isolate the query logic.
 */
const FIXTURES = [
  {
    displayName: 'Ava Animator', category: 'animator', contentTypes: ['anim', 'short'], specializations: ['kids', 'education'],
    skills: ['consist', 'story'], tools: ['Kling', 'Midjourney'], styles: ['cartoon'], formats: ['16:9'], languages: ['Tamil', 'English'],
    startingPrice: 14000, turnaroundDays: 9, availability: 'available',
    trust: { verifiedTools: ['Kling'], trustLevel: 4, ratingAvg: 4.7, ratingCount: 6 },
  },
  {
    displayName: 'Ben Video', category: 'video', secondaryCategories: ['animator'], contentTypes: ['short', 'ad'], specializations: ['beauty'],
    skills: ['prompt', 'edit'], tools: ['Kling', 'Runway', 'CapCut'], styles: ['real'], formats: ['9:16'], languages: ['Hindi', 'English'],
    startingPrice: 12000, turnaroundDays: 6, availability: 'busy',
    trust: { verifiedTools: ['Runway'], madeOnUnioCount: 2, trustLevel: 5, ratingAvg: 4.9, ratingCount: 14 },
  },
  {
    displayName: 'Cara Photos', category: 'photo', contentTypes: ['photo'], specializations: ['food'],
    skills: ['prompt', 'upscale'], tools: ['Midjourney', 'Lightroom'], styles: ['festive'], formats: ['4:5'], languages: ['Punjabi'],
    startingPrice: 4000, turnaroundDays: 2, availability: 'available',
    trust: {},
  },
];

async function seedFixtures() {
  const ids = {};
  for (const f of FIXTURES) {
    const { agent } = await signUp(app, 'creator', { name: f.displayName });
    const { trust, ...profile } = f;
    const res = await agent.put('/api/creator/profile').send(profile);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    await CreatorProfile.updateOne({ _id: res.body.data._id }, { $set: trust });
    ids[f.displayName] = res.body.data._id;
  }
  return ids;
}

const get = (qs) => request(app).get(`/api/creators${qs}`);
const names = (res) => res.body.data.items.map((c) => c.displayName).sort();

describe('Discover filters (F1-b)', () => {
  test('OR within one filter, AND across filters', async () => {
    await seedFixtures();
    assert.deepEqual(names(await get('?types=anim,photo')), ['Ava Animator', 'Cara Photos']);
    assert.deepEqual(names(await get('?types=short&spec=beauty')), ['Ben Video']);
    assert.deepEqual(names(await get('?types=short&spec=food')), []);
    assert.deepEqual(names(await get('?skills=prompt&langs=English')), ['Ben Video']);
  });

  test('category matches the main category or an also-do category', async () => {
    await seedFixtures();
    assert.deepEqual(names(await get('?cat=animator')), ['Ava Animator', 'Ben Video']);
    assert.deepEqual(names(await get('?cat=photo,video')), ['Ben Video', 'Cara Photos']);
  });

  test('verified-only switches tool matching to reviewer-verified tools', async () => {
    await seedFixtures();
    assert.deepEqual(names(await get('?tools=Kling')), ['Ava Animator', 'Ben Video']);
    assert.deepEqual(names(await get('?tools=Kling&vonly=1')), ['Ava Animator']);
    assert.deepEqual(names(await get('?vonly=1')), ['Ava Animator', 'Ben Video'], 'vonly alone = has any verified tool');
  });

  test('trust levels, budget, turnaround, availability, styles and formats', async () => {
    await seedFixtures();
    assert.deepEqual(names(await get('?trust=m')), ['Ben Video']);
    assert.deepEqual(names(await get('?trust=v')), ['Ava Animator', 'Ben Video']);
    assert.deepEqual(names(await get('?trust=c')), []);
    assert.deepEqual(names(await get('?maxPrice=12000')), ['Ben Video', 'Cara Photos']);
    assert.deepEqual(names(await get('?maxDays=6')), ['Ben Video', 'Cara Photos']);
    assert.deepEqual(names(await get('?avail=1')), ['Ava Animator', 'Cara Photos']);
    assert.deepEqual(names(await get('?styles=festive,cartoon&formats=4:5')), ['Cara Photos']);
  });

  test('q searches names, headlines and taxonomy labels', async () => {
    await seedFixtures();
    assert.deepEqual(names(await get('?q=cara')), ['Cara Photos']);
    assert.deepEqual(names(await get('?q=food')), ['Cara Photos'], 'label "Food & beverage" → food');
    assert.deepEqual(names(await get('?q=consistency')), ['Ava Animator'], 'label "Character consistency" → consist');
    assert.deepEqual(names(await get('?q=a.*')), [], 'regex characters are escaped');
  });

  test('sorts: rating (default), price, fast, made on UNIO', async () => {
    await seedFixtures();
    const order = async (qs) => (await get(qs)).body.data.items.map((c) => c.displayName);
    assert.deepEqual(await order(''), ['Ben Video', 'Ava Animator', 'Cara Photos']);
    assert.deepEqual(await order('?sort=price'), ['Cara Photos', 'Ben Video', 'Ava Animator']);
    assert.deepEqual(await order('?sort=fast'), ['Cara Photos', 'Ben Video', 'Ava Animator']);
    assert.equal((await order('?sort=mou'))[0], 'Ben Video');
  });

  test('unknown ids are rejected; Round 1 params still work', async () => {
    await seedFixtures();
    assert.equal((await get('?skills=AI%20Video')).status, 400);
    assert.equal((await get('?cat=filmmakers')).status, 400);
    assert.equal((await get('?trust=x')).status, 400);
    assert.deepEqual(names(await get('?tool=kling')), ['Ava Animator', 'Ben Video']);
    assert.deepEqual(names(await get('?search=ben')), ['Ben Video']);
    assert.deepEqual(names(await get('?availability=busy')), ['Ben Video']);
  });
});

describe('Discover facet counts', () => {
  test('each facet applies every other filter but not its own', async () => {
    await seedFixtures();
    const res = await get('?types=short&tools=Kling');
    const { facets, total } = res.body.data;
    assert.equal(total, 2);
    // Content type counts ignore the content-type filter but keep tools=Kling (Ava + Ben).
    assert.deepEqual(facets.types, { anim: 1, short: 2, ad: 1 });
    // Tool counts ignore the tool filter but keep types=short (Ava + Ben).
    assert.equal(facets.tools.Kling, 2);
    assert.equal(facets.tools.Runway, 1);
    assert.equal(facets.tools.Lightroom, undefined, 'Cara is excluded by types=short');
    // Category counts include also-do categories.
    assert.equal(facets.cat.animator, 2);
    assert.equal(facets.cat.video, 1);
    assert.equal(facets.allCategories, 2);
    assert.deepEqual(facets.trust, { v: 2, c: 0, m: 1 });
  });

  test('verified-only makes tool counts count verified tools', async () => {
    await seedFixtures();
    const { facets } = (await get('?vonly=1')).body.data;
    assert.deepEqual(facets.tools, { Kling: 1, Runway: 1 });
  });

  test('pagination keeps total and facets for the whole result', async () => {
    await seedFixtures();
    const res = await get('?limit=1&page=2');
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.total, 3);
    assert.equal(res.body.data.totalPages, 3);
    assert.equal(res.body.data.facets.allCategories, 3);
  });
});
