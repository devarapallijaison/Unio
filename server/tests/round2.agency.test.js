import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { env } from '../src/config/env.js';
import { BrandProfile, Message, Project } from '../src/models/index.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const PROPOSAL = { proposal: 'I can produce two polished vertical ads using AI-assisted product visuals.', proposedPrice: 8000, acceptedRights: true };
const CLIENT = (name = 'Verdant Skin Co.', over = {}) => ({ name, industry: 'beauty', approverName: 'Vidya Sharma', approverEmail: 'vidya@verdant.example', ...over });

async function agencyWithClient(name = 'Verdant Skin Co.') {
  const agency = await signUp(app, 'agency');
  const client = (await agency.agent.post('/api/brand/clients').send(CLIENT(name))).body.data;
  return { ...agency, client };
}

/** Agency + client + creator hired on a brief for that client, with v1 of the first deliverable submitted. */
async function agencyProject({ submitted = true } = {}) {
  const agency = await agencyWithClient();
  const creator = await signUp(app, 'creator');
  const campaign = (await agency.agent.post('/api/brand/campaigns').send(campaignPayload({ clientId: agency.client._id }))).body.data;
  const application = (await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL)).body.data;
  const accepted = await agency.agent.patch(`/api/brand/applications/${application._id}/status`).send({ status: 'accepted' });
  const project = accepted.body.data.project;
  const url = `/api/projects/${project._id}`;
  const deliverable = project.deliverables[0];
  if (submitted) {
    const res = await creator.agent.post(`${url}/deliverables/${deliverable._id}/versions`).send({ mediaUrl: 'https://cdn.example.com/spf-v1.mp4' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
  }
  return { agency, creator, campaign, project, url, deliverable };
}
const sendLink = (agent, ctx, body = {}) => agent.post(`${ctx.url}/approval-links`).send({ deliverableId: ctx.deliverable._id, ...body });
const tokenOf = (link) => link.url.split('/approve/')[1];

describe('agency clients', () => {
  test('add, list with real counts, edit, archive: each client gets its own tag colour', async () => {
    const { agent } = await signUp(app, 'agency');
    const a = await agent.post('/api/brand/clients').send(CLIENT('Verdant Skin Co.'));
    assert.equal(a.status, 201);
    assert.equal(a.body.data.initials, 'VS');
    const b = (await agent.post('/api/brand/clients').send(CLIENT('Brewhaus Coffee', { industry: 'food', approverName: '', approverEmail: '' }))).body.data;
    assert.notEqual(a.body.data.color, b.color, 'colours are handed out in turn');
    assert.equal(b.approverName, '');

    const list = (await agent.get('/api/brand/clients')).body.data;
    assert.deepEqual(list.map((c) => c.name), ['Verdant Skin Co.', 'Brewhaus Coffee']);
    assert.ok(list.every((c) => c.campaigns === 0 && c.projects === 0 && c.awaiting === 0));

    const upd = await agent.put(`/api/brand/clients/${b._id}`).send(CLIENT('Brewhaus Coffee Roasters', { color: 'teal', industry: 'food' }));
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.color, 'teal');
    assert.equal(upd.body.data.initials, 'BC');

    assert.equal((await agent.delete(`/api/brand/clients/${b._id}`)).status, 200);
    assert.deepEqual((await agent.get('/api/brand/clients')).body.data.map((c) => c.name), ['Verdant Skin Co.']);
    assert.equal((await agent.put(`/api/brand/clients/${b._id}`).send(CLIENT('Back again'))).status, 404, 'archived clients cannot be edited');
  });

  test('names are unique per agency, colours and keys are controlled', async () => {
    const { agent } = await signUp(app, 'agency');
    await agent.post('/api/brand/clients').send(CLIENT('Verdant Skin Co.'));
    const dup = await agent.post('/api/brand/clients').send(CLIENT(' verdant skin co. '));
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'CLIENT_EXISTS');
    assert.equal((await agent.post('/api/brand/clients').send(CLIENT('Nimbu', { color: 'hotpink' }))).status, 400);
    assert.equal((await agent.post('/api/brand/clients').send(CLIENT('Nimbu', { industry: 'made-up' }))).status, 400);
    assert.equal((await agent.post('/api/brand/clients').send(CLIENT('Nimbu', { approverEmail: 'not-an-email' }))).status, 400);
    assert.equal((await agent.post('/api/brand/clients').send({ ...CLIENT('Nimbu'), archived: false })).status, 400, 'unknown keys are refused');
    assert.equal((await agent.post('/api/brand/clients').send(CLIENT('N'))).status, 400);
  });

  test('only agencies: brands and creators get 403, guests 401, and agencies cannot see each other', async () => {
    const { agent: brand } = await signUp(app, 'brand');
    const { agent: creator } = await signUp(app, 'creator');
    for (const agent of [brand, creator]) {
      assert.equal((await agent.get('/api/brand/clients')).status, 403);
      assert.equal((await agent.post('/api/brand/clients').send(CLIENT())).status, 403);
    }
    assert.equal((await request(app).get('/api/brand/clients')).status, 401);

    const one = await agencyWithClient('Verdant Skin Co.');
    const { agent: other } = await signUp(app, 'agency');
    assert.deepEqual((await other.get('/api/brand/clients')).body.data, []);
    assert.equal((await other.put(`/api/brand/clients/${one.client._id}`).send(CLIENT('Stolen'))).status, 404);
    assert.equal((await other.delete(`/api/brand/clients/${one.client._id}`)).status, 404);
  });

  test('sign-up with a first client creates it with a colour; the colours are served with the taxonomy', async () => {
    const reg = await signUp(app, 'agency', { firstClientName: 'Kinetic Shoes' });
    const list = (await reg.agent.get('/api/brand/clients')).body.data;
    assert.equal(list.length, 1);
    assert.equal(list[0].initials, 'KS');
    assert.ok(list[0].color);
    const tax = (await request(app).get('/api/taxonomy')).body.data;
    assert.equal(tax.clientColors.length, 8);
    assert.ok(tax.clientColors.every((c) => /^#[0-9a-f]{6}$/i.test(c.bg) && /^#[0-9a-f]{6}$/i.test(c.fg)));
  });
});

describe('briefs and projects belong to a client', () => {
  test('agency briefs need a client of their own; brands cannot send one', async () => {
    const { agent, client } = await agencyWithClient();
    const missing = await agent.post('/api/brand/campaigns').send(campaignPayload());
    assert.equal(missing.status, 400);
    assert.equal(missing.body.error.code, 'CLIENT_REQUIRED');

    const ok = await agent.post('/api/brand/campaigns').send(campaignPayload({ clientId: client._id }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.clientName, 'Verdant Skin Co.');

    const other = await agencyWithClient('Someone else');
    assert.equal((await agent.post('/api/brand/campaigns').send(campaignPayload({ clientId: other.client._id }))).status, 404, 'another agency’s client is "not found"');
    await agent.delete(`/api/brand/clients/${client._id}`);
    assert.equal((await agent.post('/api/brand/campaigns').send(campaignPayload({ clientId: client._id }))).status, 404, 'archived clients are not offered');

    const { agent: brand } = await signUp(app, 'brand');
    assert.equal((await brand.post('/api/brand/campaigns').send(campaignPayload({ clientId: client._id }))).status, 400);
    assert.equal((await brand.post('/api/brand/campaigns').send(campaignPayload())).status, 201, 'plain brands are unaffected');
  });

  test('lists scope to one client; the public brief shows who it is for', async () => {
    const { agent, client } = await agencyWithClient('Verdant Skin Co.');
    const second = (await agent.post('/api/brand/clients').send(CLIENT('Brewhaus Coffee', { industry: 'food' }))).body.data;
    await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Verdant SPF launch', clientId: client._id }));
    await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Verdant explainers', clientId: client._id }));
    await agent.post('/api/brand/campaigns').send(campaignPayload({ title: 'Cold brew teaser', clientId: second._id }));

    const all = (await agent.get('/api/brand/campaigns')).body.data;
    assert.equal(all.total, 3);
    const verdant = (await agent.get(`/api/brand/campaigns?clientId=${client._id}`)).body.data;
    assert.equal(verdant.total, 2);
    assert.equal(verdant.statusCounts.open, 2, 'tab counts follow the client too');
    assert.equal((await agent.get(`/api/brand/campaigns?clientId=${second._id}`)).body.data.items[0].title, 'Cold brew teaser');

    const clients = (await agent.get('/api/brand/clients')).body.data;
    assert.deepEqual(Object.fromEntries(clients.map((c) => [c.name, c.campaigns])), { 'Verdant Skin Co.': 2, 'Brewhaus Coffee': 1 });

    const pub = (await request(app).get('/api/campaigns')).body.data.items.find((c) => c.title === 'Cold brew teaser');
    assert.equal(pub.clientName, 'Brewhaus Coffee');
    assert.equal(pub.brand.companyName, (await BrandProfile.findOne({ accountType: 'agency' }).lean()).companyName);
  });

  test('a brief can move between clients until it has a project, then the client is locked', async () => {
    const { agent, client } = await agencyWithClient('Verdant Skin Co.');
    const second = (await agent.post('/api/brand/clients').send(CLIENT('Brewhaus Coffee', { industry: 'food' }))).body.data;
    const creator = await signUp(app, 'creator');
    const c = (await agent.post('/api/brand/campaigns').send(campaignPayload({ clientId: client._id }))).body.data;
    const body = (over) => campaignPayload({ clientId: client._id, ...over });

    const moved = await agent.put(`/api/brand/campaigns/${c._id}`).send(body({ clientId: second._id }));
    assert.equal(moved.status, 200);
    assert.equal(moved.body.data.clientName, 'Brewhaus Coffee');

    const app1 = (await creator.agent.post(`/api/campaigns/${c._id}/applications`).send(PROPOSAL)).body.data;
    await agent.patch(`/api/brand/applications/${app1._id}/status`).send({ status: 'accepted' });
    const locked = await agent.put(`/api/brand/campaigns/${c._id}`).send(body({ clientId: client._id }));
    assert.equal(locked.status, 409);
    assert.equal(locked.body.error.code, 'CLIENT_LOCKED');
    assert.equal((await agent.put(`/api/brand/campaigns/${c._id}`).send(body({ clientId: second._id, title: 'Same client, new title' }))).status, 200);
  });

  test('projects and applicants inherit the client and can be filtered by it', async () => {
    const ctx = await agencyProject({ submitted: false });
    assert.equal(ctx.project.clientName, 'Verdant Skin Co.');
    assert.equal(String(ctx.project.clientId), String(ctx.agency.client._id));

    const other = (await ctx.agency.agent.post('/api/brand/clients').send(CLIENT('Brewhaus Coffee', { industry: 'food' }))).body.data;
    const mine = (await ctx.agency.agent.get(`/api/brand/projects?clientId=${ctx.agency.client._id}`)).body.data;
    assert.equal(mine.total, 1);
    assert.equal((await ctx.agency.agent.get(`/api/brand/projects?clientId=${other._id}`)).body.data.total, 0);
    assert.equal((await ctx.agency.agent.get(`/api/brand/applications?clientId=${ctx.agency.client._id}`)).body.data.total, 1);
    assert.equal((await ctx.agency.agent.get(`/api/brand/applications?clientId=${other._id}`)).body.data.total, 0);

    const clients = (await ctx.agency.agent.get('/api/brand/clients')).body.data;
    assert.equal(clients.find((c) => c.name === 'Verdant Skin Co.').projects, 1);

    // The creator sees the client name on the project, but nothing of the agency's private setup.
    const asCreator = (await ctx.creator.agent.get(ctx.url)).body.data.project;
    assert.equal(asCreator.clientName, 'Verdant Skin Co.');
    assert.equal(asCreator.approvalLinks, undefined);
  });

  test('renaming a client updates the copies on its briefs and projects', async () => {
    const ctx = await agencyProject({ submitted: false });
    await ctx.agency.agent.put(`/api/brand/clients/${ctx.agency.client._id}`).send(CLIENT('Verdant Skincare'));
    assert.equal((await Project.findById(ctx.project._id).lean()).clientName, 'Verdant Skincare');
    assert.equal((await ctx.agency.agent.get(`/api/brand/campaigns/${ctx.campaign._id}`)).body.data.clientName, 'Verdant Skincare');
  });
});

describe('client approval links', () => {
  test('only an agency can send one, only for a version waiting for a decision', async () => {
    const ctx = await agencyProject({ submitted: false });
    const early = await sendLink(ctx.agency.agent, ctx);
    assert.equal(early.status, 409);
    assert.equal(early.body.error.code, 'NOTHING_TO_APPROVE');

    const submitted = await agencyProject();
    assert.equal((await sendLink(submitted.creator.agent, submitted)).status, 403, 'creators cannot');
    assert.equal((await request(app).post(`${submitted.url}/approval-links`).send({ deliverableId: submitted.deliverable._id })).status, 401);
    const { agent: stranger } = await signUp(app, 'agency');
    assert.equal((await sendLink(stranger, submitted)).status, 404, 'someone else’s project is not found');

    // plain brands have no clients, so no links
    const brand = await signUp(app, 'brand');
    const creator = await signUp(app, 'creator');
    const camp = (await brand.agent.post('/api/brand/campaigns').send(campaignPayload())).body.data;
    const appl = (await creator.agent.post(`/api/campaigns/${camp._id}/applications`).send(PROPOSAL)).body.data;
    const proj = (await brand.agent.patch(`/api/brand/applications/${appl._id}/status`).send({ status: 'accepted' })).body.data.project;
    await creator.agent.post(`/api/projects/${proj._id}/deliverables/${proj.deliverables[0]._id}/versions`).send({ mediaUrl: 'https://cdn.example.com/a.mp4' });
    const denied = await brand.agent.post(`/api/projects/${proj._id}/approval-links`).send({ deliverableId: proj.deliverables[0]._id });
    assert.equal(denied.status, 403);
  });

  test('the URL is shown once; only a hash is stored; the agency sees status without the token', async () => {
    const ctx = await agencyProject();
    const res = await sendLink(ctx.agency.agent, ctx);
    assert.equal(res.status, 201);
    const link = res.body.data;
    assert.match(link.url, new RegExp(`^${env.publicSiteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/approve/[A-Za-z0-9_-]{43}$`));
    assert.equal(link.approverName, 'Vidya Sharma', 'defaults to the approver saved on the client');
    assert.ok(new Date(link.expiresAt) - Date.now() > 6.9 * 86400000);

    const token = tokenOf(link);
    const stored = (await Project.findById(ctx.project._id).lean()).approvalLinks[0];
    assert.equal(stored.tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(!JSON.stringify(stored).includes(token), 'the token itself is never stored');

    const brandView = (await ctx.agency.agent.get(ctx.url)).body.data.project;
    assert.equal(brandView.approvalLinks.length, 1);
    assert.equal(brandView.approvalLinks[0].tokenHash, undefined);
    assert.equal(brandView.approvalLinks[0].approverName, 'Vidya Sharma');
    const list = (await ctx.agency.agent.get('/api/brand/projects')).body.data.items[0];
    assert.equal(list.approvalLinks, undefined, 'lists never carry link details');
    assert.equal((await ctx.creator.agent.get(ctx.url)).body.data.project.approvalLinks, undefined);

    const msgs = await Message.find({ projectId: ctx.project._id, kind: 'system' }).lean();
    assert.ok(msgs.some((m) => /Approval link sent to Vidya Sharma for v1/.test(m.body)));
  });

  test('the client opens it without logging in and sees only that version', async () => {
    const ctx = await agencyProject();
    const token = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    const res = await request(app).get(`/api/approve/${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
    const d = res.body.data;
    assert.equal(d.state, 'open');
    assert.equal(d.clientName, 'Verdant Skin Co.');
    assert.equal(d.approverName, 'Vidya Sharma');
    assert.equal(d.version.number, 1);
    assert.equal(d.version.mediaUrl, 'https://cdn.example.com/spf-v1.mp4');
    const text = JSON.stringify(res.body);
    for (const secret of ['proposedPrice', 'approverEmail', 'vidya@verdant.example', 'tokenHash', 'rightsSnapshot', 'brandId']) assert.ok(!text.includes(secret), `no ${secret}`);

    const opened = (await ctx.agency.agent.get('/api/brand/approvals')).body.data.items[0];
    assert.ok(opened.openedAt, 'the agency can see it was opened');
  });

  test('bad and unknown tokens', async () => {
    assert.equal((await request(app).get('/api/approve/short')).status, 400);
    assert.equal((await request(app).get(`/api/approve/${'a'.repeat(43)}`)).status, 404);
    assert.equal((await request(app).post(`/api/approve/${'a'.repeat(43)}`).send({ decision: 'approve' })).status, 404);
  });

  test('"changes" needs a note of 10+ characters; the answer is advice, the agency still decides', async () => {
    const ctx = await agencyProject();
    const token = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    const short = await request(app).post(`/api/approve/${token}`).send({ decision: 'changes', note: 'too short' });
    assert.equal(short.status, 400);
    assert.equal(short.body.error.code, 'NOTE_REQUIRED');
    assert.equal((await request(app).get(`/api/approve/${token}`)).body.data.state, 'open', 'a refused answer does not use the link up');

    const res = await request(app).post(`/api/approve/${token}`).send({ decision: 'changes', note: 'Swap the end card for our green', approverName: 'Vidya S.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.decision, 'changes');

    // The version is still waiting for the agency, and the creator has heard nothing from the client.
    const project = (await ctx.agency.agent.get(ctx.url)).body.data.project;
    assert.equal(project.deliverables[0].versions[0].status, 'submitted');
    assert.equal(project.revisionsUsed, 0);
    const approvals = (await ctx.agency.agent.get('/api/brand/approvals')).body.data;
    assert.equal(approvals.items[0].status, 'answered');
    assert.equal(approvals.items[0].note, 'Swap the end card for our green');
    assert.deepEqual(approvals.counts, { awaiting: 0, answered: 1 });
    const sys = await Message.find({ projectId: ctx.project._id, kind: 'system' }).lean();
    assert.ok(sys.some((m) => /Vidya S\. asked for changes to v1/.test(m.body)));
  });

  test('a link works once', async () => {
    const ctx = await agencyProject();
    const token = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    const [a, b] = await Promise.all([
      request(app).post(`/api/approve/${token}`).send({ decision: 'approve' }),
      request(app).post(`/api/approve/${token}`).send({ decision: 'approve' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409], 'two answers racing: exactly one is recorded');
    const again = await request(app).post(`/api/approve/${token}`).send({ decision: 'changes', note: 'Actually change everything' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'LINK_USED');
    const view = (await request(app).get(`/api/approve/${token}`)).body.data;
    assert.equal(view.state, 'used');
    assert.equal(view.decision, 'approved');
    assert.equal(view.version, null, 'the work is no longer shown once answered');
    const project = (await ctx.agency.agent.get(ctx.url)).body.data.project;
    assert.equal(project.deliverables[0].versions[0].status, 'submitted', 'approval through the link does not approve the version by itself');
  });

  test('links expire after 7 days, and a newer link replaces an older one', async () => {
    const ctx = await agencyProject();
    const first = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    const second = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    assert.notEqual(first, second);
    assert.equal((await request(app).get(`/api/approve/${first}`)).body.data.state, 'expired', 'the replaced link stops working');
    assert.equal((await request(app).post(`/api/approve/${first}`).send({ decision: 'approve' })).status, 410);
    assert.equal((await request(app).get(`/api/approve/${second}`)).body.data.state, 'open');

    const list = (await ctx.agency.agent.get('/api/brand/approvals')).body.data;
    assert.equal(list.items.length, 1, 'only the current link per version is listed');
    assert.deepEqual(list.counts, { awaiting: 1, answered: 0 });
    const clients = (await ctx.agency.agent.get('/api/brand/clients')).body.data;
    assert.equal(clients[0].awaiting, 1, 'the client card counts it as awaiting');

    await Project.updateOne({ _id: ctx.project._id }, { $set: { 'approvalLinks.$[l].expiresAt': new Date(Date.now() - 1000) } }, { arrayFilters: [{ 'l.tokenHash': crypto.createHash('sha256').update(second).digest('hex') }] });
    assert.equal((await request(app).get(`/api/approve/${second}`)).body.data.state, 'expired');
    const post = await request(app).post(`/api/approve/${second}`).send({ decision: 'approve' });
    assert.equal(post.status, 410);
    assert.equal(post.body.error.code, 'LINK_EXPIRED');
    assert.equal((await ctx.agency.agent.get('/api/brand/clients')).body.data[0].awaiting, 0);
  });

  test('once the agency has decided, the link is closed', async () => {
    const ctx = await agencyProject();
    const token = tokenOf((await sendLink(ctx.agency.agent, ctx)).body.data);
    const decided = await ctx.agency.agent.post(`${ctx.url}/deliverables/${ctx.deliverable._id}/versions/1/decision`).send({ decision: 'approve' });
    assert.equal(decided.status, 200);
    assert.equal((await request(app).get(`/api/approve/${token}`)).body.data.state, 'closed');
    const post = await request(app).post(`/api/approve/${token}`).send({ decision: 'approve' });
    assert.equal(post.status, 409);
    assert.equal(post.body.error.code, 'LINK_CLOSED');
    assert.equal((await ctx.agency.agent.get('/api/brand/approvals')).body.data.items[0].status, 'closed');
  });

  test('approvals list: agencies only, scoped by client', async () => {
    const ctx = await agencyProject();
    await sendLink(ctx.agency.agent, ctx);
    const other = (await ctx.agency.agent.post('/api/brand/clients').send(CLIENT('Brewhaus Coffee', { industry: 'food' }))).body.data;
    assert.equal((await ctx.agency.agent.get(`/api/brand/approvals?clientId=${ctx.agency.client._id}`)).body.data.items.length, 1);
    assert.equal((await ctx.agency.agent.get(`/api/brand/approvals?clientId=${other._id}`)).body.data.items.length, 0);
    const { agent: brand } = await signUp(app, 'brand');
    assert.equal((await brand.get('/api/brand/approvals')).status, 403);
    assert.equal((await ctx.creator.agent.get('/api/brand/approvals')).status, 403);
  });
});
