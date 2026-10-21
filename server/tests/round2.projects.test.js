import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { campaignPayload, resetDb, signUp, startDb, stopDb } from './helpers.js';
import { Campaign, CreatorProfile, Message } from '../src/models/index.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const PROPOSAL = { proposal: 'I can produce two polished vertical ads using AI-assisted product visuals.', proposedPrice: 8000, acceptedRights: true };
const MEDIA = (n) => `https://cdn.example.com/spf-v${n}.mp4`;

/** Brand + creator + an accepted application → a project with two deliverables. */
async function hiredProject({ revisionsIncluded = 2 } = {}) {
  const brand = await signUp(app, 'brand');
  const creator = await signUp(app, 'creator');
  const campaign = (
    await brand.agent.post('/api/brand/campaigns').send(
      campaignPayload({
        revisionsIncluded,
        deliverables: [
          { title: 'Vertical video', description: '9:16 · 15–20 s', quantity: 1 },
          { title: 'Still', description: '4:5', quantity: 1 },
        ],
      }),
    )
  ).body.data;
  const application = (await creator.agent.post(`/api/campaigns/${campaign._id}/applications`).send(PROPOSAL)).body.data;
  const accepted = await brand.agent.patch(`/api/brand/applications/${application._id}/status`).send({ status: 'accepted' });
  const project = accepted.body.data.project;
  return { brand, creator, campaign, project, url: `/api/projects/${project._id}` };
}

const submit = (agent, url, d, body) => agent.post(`${url}/deliverables/${d._id}/versions`).send({ mediaUrl: MEDIA(1), ...body });
const decide = (agent, url, d, n, body) => agent.post(`${url}/deliverables/${d._id}/versions/${n}/decision`).send(body);

describe('F6 versions and decisions', () => {
  test('rights + revisions are snapshotted at hire; later campaign edits do not change the project', async () => {
    const { brand, campaign, project, url } = await hiredProject({ revisionsIncluded: 3 });
    assert.equal(project.revisionsIncluded, 3);
    assert.deepEqual(project.rightsSnapshot.usage, ['paid_ads', 'organic_social']);
    await Campaign.updateOne({ _id: campaign._id }, { $set: { 'rights.region': 'worldwide' } });
    const res = await brand.agent.get(url);
    assert.equal(res.body.data.project.rightsSnapshot.region, 'india');
    assert.equal(res.body.data.project.rightsSummary, 'Paid ads + Organic social · India · 6 months · Non-exclusive');
  });

  test('creator submits v1 (default note) then v2 needs a change note; brand cannot submit', async () => {
    const { brand, creator, project, url } = await hiredProject();
    const [video] = project.deliverables;

    assert.equal((await submit(brand.agent, url, video, {})).status, 403, 'brand cannot submit versions');

    const v1 = await submit(creator.agent, url, video, { toolsUsed: ['Kling'] });
    assert.equal(v1.status, 201);
    const d1 = v1.body.data.project.deliverables[0];
    assert.equal(d1.currentVersion, 1);
    assert.equal(d1.versions[0].changeNote, 'First version');
    assert.equal(d1.status, 'submitted', 'deliverable mirrors the latest version');
    assert.equal(d1.mediaUrl, MEDIA(1));
    assert.equal(v1.body.data.project.status, 'in_progress', 'one of two deliverables submitted');

    const again = await submit(creator.agent, url, video, { mediaUrl: MEDIA(2), changeNote: 'Tighter hook' });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'AWAITING_DECISION');

    await decide(brand.agent, url, video, 1, { decision: 'changes', note: 'Hook needs to land in 2 seconds.' });
    const noNote = await submit(creator.agent, url, video, { mediaUrl: MEDIA(2) });
    assert.equal(noNote.status, 400);
    assert.equal(noNote.body.error.details[0].field, 'changeNote');
    const v2 = await submit(creator.agent, url, video, { mediaUrl: MEDIA(2), changeNote: 'Hook moved to the first 2 seconds' });
    assert.equal(v2.status, 201);
    assert.equal(v2.body.data.project.deliverables[0].currentVersion, 2);
  });

  test('changes need a note of at least 10 characters; one revision round per cycle; warning when used up', async () => {
    const { brand, creator, project, url } = await hiredProject({ revisionsIncluded: 1 });
    const [video, still] = project.deliverables;
    await submit(creator.agent, url, video, {});
    await submit(creator.agent, url, still, {});

    const short = await decide(brand.agent, url, video, 1, { decision: 'changes', note: 'redo' });
    assert.equal(short.status, 400);
    assert.equal(short.body.error.code, 'NOTE_REQUIRED');
    assert.equal((await decide(creator.agent, url, video, 1, { decision: 'approve' })).status, 403, 'creator cannot decide');

    const first = await decide(brand.agent, url, video, 1, { decision: 'changes', note: 'Warmer light, please.' });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.project.status, 'revision_requested');
    assert.equal(first.body.data.project.revisionsUsed, 1);
    assert.equal(first.body.data.warning, undefined);
    const sameRound = await decide(brand.agent, url, still, 1, { decision: 'changes', note: 'Crop tighter on the bottle.' });
    assert.equal(sameRound.body.data.project.revisionsUsed, 1, 'same review cycle counts once');

    await submit(creator.agent, url, video, { mediaUrl: MEDIA(2), changeNote: 'Warmer grade' });
    await submit(creator.agent, url, still, { mediaUrl: MEDIA(2), changeNote: 'Tighter crop' });
    const over = await decide(brand.agent, url, video, 2, { decision: 'changes', note: 'One more pass on the colour.' });
    assert.equal(over.status, 200, 'not blocked');
    assert.equal(over.body.data.warning, 'Revision rounds used up — agree extra rounds in messages.');
    assert.equal(over.body.data.project.revisionsUsed, 2);

    const old = await decide(brand.agent, url, video, 1, { decision: 'approve' });
    assert.equal(old.status, 409, 'only the latest submitted version can be reviewed');
  });

  test('approving every deliverable completes the project with a rights card, ★ count and system messages', async () => {
    const { brand, creator, project, url } = await hiredProject();
    const [video, still] = project.deliverables;
    await submit(creator.agent, url, video, { toolsUsed: ['Kling', 'Runway'] });
    await submit(creator.agent, url, still, { toolsUsed: ['Midjourney'] });
    assert.equal((await brand.agent.get(url)).body.data.project.status, 'submitted');
    assert.equal((await brand.agent.get(`${url}/rights-card`)).status, 409, 'no card before completion');

    await decide(brand.agent, url, video, 1, { decision: 'approve' });
    const done = await decide(brand.agent, url, still, 1, { decision: 'approve' });
    const p = done.body.data.project;
    assert.equal(p.status, 'completed');
    assert.match(p.rightsCard.number, /^UN-\d{4}-\d{4}$/);
    assert.deepEqual(p.rightsCard.toolsUsed.sort(), ['Kling', 'Midjourney', 'Runway']);
    assert.equal(p.rightsCard.summary, 'Paid ads + Organic social · India · 6 months · Non-exclusive');
    const months = (new Date(p.rightsCard.validTo) - new Date(p.rightsCard.validFrom)) / (30 * 86_400_000);
    assert.ok(months > 5.8 && months < 6.2, 'valid for the snapshot duration');

    const card = await creator.agent.get(`${url}/rights-card`);
    assert.equal(card.status, 200);
    assert.equal(card.body.data.card.number, p.rightsCard.number);

    const profile = await CreatorProfile.findById(p.creatorId).lean();
    assert.equal(profile.madeOnUnioCount, 1);

    const sys = await Message.find({ projectId: p._id, kind: 'system' }).sort({ createdAt: 1 }).lean();
    assert.ok(sys.some((m) => /uploaded v1 of “Vertical video”/.test(m.body)));
    assert.ok(sys.at(-1).body.includes(p.rightsCard.number));

    assert.equal((await submit(creator.agent, url, video, { mediaUrl: MEDIA(9), changeNote: 'late' })).body.error.code, 'PROJECT_CLOSED');
  });
});

describe('F6 messages and unread counts', () => {
  test('participants post, poll with ?after, tag a version; outsiders get 404; unread clears on read', async () => {
    const { brand, creator, project, url } = await hiredProject();
    const outsider = await signUp(app, 'brand');
    const [video] = project.deliverables;
    await submit(creator.agent, url, video, {});

    assert.equal((await outsider.agent.get(`${url}/messages`)).status, 404);
    assert.equal((await outsider.agent.post(`${url}/messages`).send({ body: 'hi' })).status, 404);

    const first = await brand.agent.get(`${url}/messages`);
    assert.equal(first.status, 200);
    assert.equal(first.body.data.items.length, 1, 'the v1 system message');
    const since = first.body.data.serverTime;

    const bad = await brand.agent.post(`${url}/messages`).send({ body: 'About v9', about: { deliverableId: video._id, versionNumber: 9 } });
    assert.equal(bad.status, 400);
    const sent = await brand.agent.post(`${url}/messages`).send({ body: 'Love the texture shots!', about: { deliverableId: video._id, versionNumber: 1 } });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.about.versionNumber, 1);
    assert.equal(sent.body.data.senderRole, 'brand');

    const polled = await creator.agent.get(`${url}/messages`).query({ after: since });
    assert.deepEqual(polled.body.data.items.map((m) => m.body), ['Love the texture shots!']);
    assert.equal(polled.body.data.items[0].mine, false);

    const unread = await creator.agent.get('/api/me/unread');
    assert.equal(unread.body.data.total, 2, 'system message + brand message');
    assert.equal(unread.body.data.byProject[project._id], 2);
    assert.equal((await brand.agent.get('/api/me/unread')).body.data.total, 1, 'own messages never count');

    await creator.agent.post(`${url}/read`);
    assert.equal((await creator.agent.get('/api/me/unread')).body.data.total, 0);
    const list = await creator.agent.get('/api/creator/projects');
    assert.equal(list.body.data.items[0].unreadCount, 0);
  });
});
