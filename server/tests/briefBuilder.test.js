import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import request from 'supertest';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { __setClientForTests, normalizeDraft, templateDraft } from '../src/services/briefBuilder.service.js';

/** Build an SDK error instance without depending on constructor signatures. */
const sdkError = (Cls, props = {}) => Object.assign(Object.create(Cls.prototype), { message: 'mock', ...props });

const GOOD_DRAFT = {
  title: 'Monsoon SPF gel launch',
  category: 'beauty',
  objective: 'Launch a lightweight SPF gel for humid weather and drive first purchases.',
  targetAudience: 'Women and men 20–35 in Indian metros who commute daily.',
  creativeStyle: 'Fresh, honest, close-up textures; no exaggerated skin claims.',
  deliverables: [
    { title: 'Vertical video', description: '15–30s, 9:16', quantity: 2 },
    { title: '', description: 'dropped: no title', quantity: 1 },
  ],
  requiredSkills: ['AI Video', 'ai video', 'Product Advertising'],
  requiredTools: ['Kling', 'Runway'],
  budgetMin: 20000,
  budgetMax: 8000,
  deadlineDays: 21,
  notes: '',
};

function fakeClient(impl) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        parse: async (params) => {
          calls.push(params);
          return impl(params);
        },
      },
    },
  };
}

describe('normalizeDraft', () => {
  test('cleans, dedupes, swaps inverted budget, composes brief, drops empty deliverables', () => {
    const now = new Date('2026-10-11T00:00:00Z');
    const { fields, warnings } = normalizeDraft(GOOD_DRAFT, { now });
    assert.equal(fields.category, 'Beauty');
    assert.deepEqual(fields.requiredSkills, ['AI Video', 'Product Advertising']);
    assert.equal(fields.budgetMin, 8000);
    assert.equal(fields.budgetMax, 20000);
    assert.equal(fields.deadline, '2026-11-01');
    assert.equal(fields.deliverables.length, 1);
    assert.match(fields.brief, /^Objective\n/);
    assert.match(fields.brief, /Target audience\n/);
    assert.equal(fields.status, 'draft');
    assert.deepEqual(warnings, []);
  });

  test('survives malformed input with safe defaults and warnings', () => {
    for (const junk of [null, 'not json', 42, { deliverables: 'x', requiredSkills: 'y', budgetMin: 'abc', deadlineDays: 9999 }]) {
      const { fields, warnings } = normalizeDraft(junk);
      assert.ok(fields.title.length >= 4);
      assert.ok(fields.brief.length >= 20);
      assert.equal(fields.deliverables.length, 1);
      assert.match(fields.deadline, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(warnings.length > 0);
    }
  });

  test('output always satisfies the campaign create validator', async () => {
    const { campaignBody } = await import('../src/validators/index.js');
    for (const input of [GOOD_DRAFT, null, templateDraft('Short reels for our new masala chai, budget 15k, in 2 weeks')]) {
      const { fields } = normalizeDraft(input);
      const result = campaignBody.safeParse(fields);
      assert.ok(result.success, JSON.stringify(result.error?.issues));
    }
  });
});

describe('templateDraft', () => {
  test('extracts category, formats, budget and timing from the idea', () => {
    const d = templateDraft('Instagram reels for our new masala chai launch, budget ₹15k, need it in 2 weeks');
    assert.equal(d.category, 'Food & Beverage');
    assert.equal(d.budgetMax, 15000);
    assert.equal(d.deadlineDays, 14);
    assert.ok(d.deliverables.some((x) => /vertical/i.test(x.title)));
    assert.ok(d.requiredSkills.includes('AI Video'));
  });
});

describe('POST /api/brand/briefs/draft', () => {
  let app;
  before(async () => {
    app = await startDb();
  });
  after(stopDb);
  beforeEach(resetDb);
  afterEach(() => __setClientForTests(null));

  const IDEA = { idea: 'Short vertical ads for our summer SPF gel, fresh and honest, budget around 15k' };

  test('role and input checks', async () => {
    const { agent: creator } = await signUp(app, 'creator');
    assert.equal((await request(app).post('/api/brand/briefs/draft').send(IDEA)).status, 401);
    assert.equal((await creator.post('/api/brand/briefs/draft').send(IDEA)).status, 403);
    const { agent: brand } = await signUp(app, 'brand');
    assert.equal((await brand.post('/api/brand/briefs/draft').send({ idea: 'too short' })).status, 400);
  });

  test('without an API key returns a clearly labelled template draft', async () => {
    const { agent } = await signUp(app, 'brand');
    const res = await agent.post('/api/brand/briefs/draft').send(IDEA);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'template');
    assert.equal(res.body.data.reason, 'no_api_key');
    assert.match(res.body.data.warnings[0], /Template draft, not AI/);
    // The draft can be saved as-is through the normal campaign endpoint.
    const saved = await agent.post('/api/brand/campaigns').send(res.body.data.fields);
    assert.equal(saved.status, 201);
    assert.equal(saved.body.data.status, 'draft');
  });

  test('AI path: sends structured-output request and returns normalized fields', async () => {
    const fake = fakeClient(() => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', parsed_output: GOOD_DRAFT }));
    __setClientForTests(fake);
    const { agent } = await signUp(app, 'brand');
    const res = await agent.post('/api/brand/briefs/draft').send(IDEA);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.source, 'ai');
    assert.equal(res.body.data.fields.budgetMin, 8000);
    assert.equal(fake.calls.length, 1);
    const params = fake.calls[0];
    assert.equal(params.model, 'claude-opus-5-5');
    assert.ok(params.output_config.format, 'uses structured outputs');
    assert.match(params.messages[0].content, /<idea>[\s\S]*SPF gel[\s\S]*<\/idea>/);
  });

  test('mode=template skips the AI even when configured', async () => {
    const fake = fakeClient(() => assert.fail('should not call AI'));
    __setClientForTests(fake);
    const { agent } = await signUp(app, 'brand');
    const res = await agent.post('/api/brand/briefs/draft').send({ ...IDEA, mode: 'template' });
    assert.equal(res.body.data.source, 'template');
    assert.equal(fake.calls.length, 0);
  });

  test('maps AI failures to clear errors', async () => {
    const { agent } = await signUp(app, 'brand');
    const cases = [
      [() => { throw sdkError(Anthropic.RateLimitError, { status: 429 }); }, 429, 'AI_RATE_LIMITED'],
      [() => { throw sdkError(Anthropic.APIConnectionTimeoutError); }, 504, 'AI_TIMEOUT'],
      [() => { throw sdkError(Anthropic.AuthenticationError, { status: 401 }); }, 502, 'AI_MISCONFIGURED'],
      [() => { throw sdkError(Anthropic.InternalServerError, { status: 529 }); }, 502, 'AI_UNAVAILABLE'],
      [() => { throw new SyntaxError('Unexpected token'); }, 502, 'AI_BAD_RESPONSE'],
      [() => ({ stop_reason: 'end_turn', parsed_output: null }), 502, 'AI_BAD_RESPONSE'],
      [() => ({ stop_reason: 'max_tokens', parsed_output: GOOD_DRAFT }), 502, 'AI_BAD_RESPONSE'],
      [() => ({ stop_reason: 'refusal', parsed_output: null }), 422, 'AI_REFUSED'],
    ];
    for (const [impl, status, code] of cases) {
      __setClientForTests(fakeClient(impl));
      const res = await agent.post('/api/brand/briefs/draft').send(IDEA);
      assert.equal(res.status, status, code);
      assert.equal(res.body.error.code, code);
    }
  });

  test('normalized AI output can be published without edits', async () => {
    __setClientForTests(fakeClient(() => ({ stop_reason: 'end_turn', model: 'claude-opus-5-5', parsed_output: GOOD_DRAFT })));
    const { agent } = await signUp(app, 'brand');
    const { fields } = (await agent.post('/api/brand/briefs/draft').send(IDEA)).body.data;
    const res = await agent.post('/api/brand/campaigns').send({ ...campaignPayload(), ...fields, status: 'open' });
    assert.equal(res.status, 201);
  });
});
