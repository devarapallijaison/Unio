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
  assert.equal(first.projects, 2);

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
  // No invented ratings or ★ Made on UNIO counts without completed projects.
  assert.equal(await db.collection('creatorProfiles').countDocuments({ $or: [{ ratingCount: { $gt: 0 } }, { madeOnUnioCount: { $gt: 0 } }] }), 0);
  // Re-seeding must not overwrite media a creator replaced.
  await db.collection('portfolioItems').updateOne({}, { $set: { mediaUrl: 'https://real.cdn.test/x.jpg' } });
  await seed();
  assert.equal(await db.collection('portfolioItems').countDocuments({ mediaUrl: 'https://real.cdn.test/x.jpg' }), 1);
  const hash = (await db.collection('users').findOne({})).passwordHash;
  assert.match(hash, /^\$2[aby]\$/);
});
