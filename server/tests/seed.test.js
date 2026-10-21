import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { after, before, test } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const run = promisify(execFile);
const seedPath = fileURLToPath(new URL('../scripts/seed.js', import.meta.url));
let replSet;
let uri;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  uri = replSet.getUri('invitaizen');
});
after(async () => {
  await mongoose.disconnect();
  await replSet?.stop();
});

async function seed() {
  await run(process.execPath, [seedPath], {
    env: { ...process.env, MONGODB_URI: uri, SEED_DEMO_PASSWORD: 'SeedTest123!', JWT_SECRET: 'x', NODE_ENV: 'test' },
  });
}

test('seed is idempotent and references are valid', async () => {
  await seed();
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        ['users', 'creatorProfiles', 'brandProfiles', 'portfolioItems', 'campaigns', 'applications', 'invitations', 'projects', 'verificationSubmissions'].map(
          async (c) => [c, await db.collection(c).countDocuments()],
        ),
      ),
    );
  const first = await snapshot();
  await seed();
  const second = await snapshot();

  assert.deepEqual(second, first);
  assert.equal(first.creatorProfiles, 17);
  assert.equal(await db.collection('creatorProfiles').countDocuments({ isDemo: true }), 12);
  // The 11 v9 creators are present with a category and at least one piece showing how it was made.
  for (const name of ['Meera Kulkarni', 'Ananya Rao', 'Arjun Menon', 'Rohan Das', 'Kabir Malhotra', 'Ishita Bansal', 'Zoya Siddiqui', 'Vihaan Shah', 'Sana Qureshi', 'Dev Patil', 'Tara Iyer']) {
    const p = await db.collection('creatorProfiles').findOne({ displayName: name });
    assert.ok(p?.category, `${name} needs a category`);
    assert.ok(await db.collection('portfolioItems').countDocuments({ creatorId: p._id, 'workflow.0': { $exists: true } }), `${name} needs a piece with workflow`);
  }
  for (const name of ['Fawaz Ahmed', 'Sai Charitha', 'Roha Nawaz', 'Shameer', 'Jaison']) {
    assert.ok(await db.collection('creatorProfiles').findOne({ displayName: name }), `${name} missing`);
  }
  assert.equal(first.projects, 6);

  // Every reference resolves.
  const ids = async (coll) => new Set((await db.collection(coll).find({}, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
  const creatorIds = await ids('creatorProfiles');
  const campaignIds = await ids('campaigns');
  for (const coll of ['portfolioItems', 'applications', 'invitations', 'projects']) {
    for (const doc of await db.collection(coll).find().toArray()) {
      assert.ok(creatorIds.has(String(doc.creatorId)), `${coll} has dangling creatorId`);
      if (doc.campaignId) assert.ok(campaignIds.has(String(doc.campaignId)), `${coll} has dangling campaignId`);
    }
  }
  // Verification outcomes come only from the reviewer service (guide §9): every VERIFIED claim was decided
  // by the seeded reviewer with a "Demo seed" note, only for demo creators, and nothing is REJECTED.
  const reviewer = await db.collection('users').findOne({ role: 'reviewer' });
  assert.ok(reviewer);
  assert.equal(await db.collection('verificationSubmissions').countDocuments({ status: 'REJECTED' }), 0);
  const verified = await db.collection('verificationSubmissions').find({ status: 'VERIFIED' }).toArray();
  assert.ok(verified.length > 0);
  for (const v of verified) {
    assert.equal(String(v.reviewerId), String(reviewer._id));
    assert.match(v.reviewNote, /^Demo seed/);
    assert.ok(v.reviewedAt);
    const p = await db.collection('creatorProfiles').findOne({ _id: v.creatorId });
    assert.equal(p.isDemo, true, 'team drafts are never verified');
    assert.ok(p.verifiedTools.includes(v.subject), 'trust fields come from the recompute');
  }
  assert.ok(await db.collection('verificationSubmissions').countDocuments({ status: 'PENDING' }) > 0);
  // F5 demo: a pending tool claim that went through the challenge flow, with honest "unknown" link checks.
  const challenged = await db.collection('verificationSubmissions').findOne({ method: 'challenge', status: 'PENDING' });
  assert.ok(challenged, 'a pending challenge claim');
  assert.match(challenged.challengeCode, /^UNIO-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(challenged.screenshotUrls.length, 2);
  assert.equal(challenged.checks.find((c) => c.id === 'reachable').result, 'unknown', 'placeholder links are never reported as reachable');
  assert.equal(await db.collection('verificationSubmissions').countDocuments({ method: 'challenge' }), 1);
  // No invented ratings; ★ Made on UNIO counts equal the creator's completed projects exactly.
  assert.equal(await db.collection('creatorProfiles').countDocuments({ ratingCount: { $gt: 0 } }), 0);
  for (const p of await db.collection('creatorProfiles').find({}).toArray()) {
    const completed = await db.collection('projects').countDocuments({ creatorId: p._id, status: 'completed' });
    assert.equal(p.madeOnUnioCount ?? 0, completed, `${p.displayName} ★ count`);
  }
  // F6 demo: one project with v1–v3 + messages, one completed with a rights card.
  const withHistory = await db.collection('projects').findOne({ 'deliverables.currentVersion': 3 });
  assert.ok(withHistory, 'a project with v1–v3');
  assert.ok((await db.collection('messages').countDocuments({ projectId: withHistory._id, kind: 'user' })) >= 2);
  const done = await db.collection('projects').findOne({ status: 'completed' });
  assert.match(done.rightsCard.number, /^UN-\d{4}-\d{4}$/);
  // F2 demo: Pixel & Pine Studio, four clients, briefs and projects tagged by client, two approval links waiting.
  const agency = await db.collection('brandProfiles').findOne({ accountType: 'agency' });
  assert.equal(agency.companyName, 'Pixel & Pine Studio');
  assert.deepEqual(agency.clients.map((c) => c.name), ['Verdant Skin Co.', 'Brewhaus Coffee', 'Kinetic Shoes', 'Nimbu Drinks']);
  assert.equal(new Set(agency.clients.map((c) => c.color)).size, 4, 'each client has its own colour');
  const agencyCampaigns = await db.collection('campaigns').find({ brandId: agency.userId }).toArray();
  assert.equal(agencyCampaigns.length, 5);
  assert.ok(agencyCampaigns.every((c) => agency.clients.some((cl) => String(cl._id) === String(c.clientId) && cl.name === c.clientName)), 'every agency brief has a real client');
  const agencyProjects = await db.collection('projects').find({ brandId: agency.userId }).toArray();
  assert.equal(agencyProjects.length, 4);
  assert.ok(agencyProjects.every((p) => p.clientId && p.clientName));
  const links = agencyProjects.flatMap((p) => p.approvalLinks ?? []);
  assert.equal(links.length, 2);
  assert.ok(links.every((l) => /^[a-f0-9]{64}$/.test(l.tokenHash) && !l.usedAt && !l.openedAt), 'links are stored as hashes and nothing is faked as opened or answered');
  assert.equal(agencyProjects.filter((p) => p.status === 'completed').length, 1);

  // Re-seeding must not overwrite media a creator replaced.
  await db.collection('portfolioItems').updateOne({}, { $set: { mediaUrl: 'https://real.cdn.test/x.jpg' } });
  await seed();
  assert.equal(await db.collection('portfolioItems').countDocuments({ mediaUrl: 'https://real.cdn.test/x.jpg' }), 1);
  const hash = (await db.collection('users').findOne({})).passwordHash;
  assert.match(hash, /^\$2[aby]\$/);
});
