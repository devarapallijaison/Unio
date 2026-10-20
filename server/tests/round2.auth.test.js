import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { registerFields, resetDb, startDb, stopDb } from './helpers.js';
import { BrandProfile, CreatorProfile } from '../src/models/index.js';
import { CATEGORY_IDS, SPECIALIZATION_IDS } from '../src/models/taxonomy.js';

let app;
before(async () => {
  app = await startDb();
});
after(stopDb);
beforeEach(resetDb);

const account = (email) => ({ name: 'Kavya Nair', email, password: 'StrongPass123!' });
const register = (body) => request(app).post('/api/auth/register').send(body);
const fields = (res) => res.body.error.details.map((d) => d.field);

describe('taxonomy', () => {
  test('GET /api/taxonomy returns every controlled list with stable ids and caches for an hour', async () => {
    const res = await request(app).get('/api/taxonomy');
    assert.equal(res.status, 200);
    assert.match(res.headers['cache-control'], /max-age=3600/);
    const t = res.body.data;
    assert.equal(t.categories.length, 12);
    assert.equal(t.contentTypes.length, 14);
    assert.equal(t.specializations.length, 14);
    assert.equal(t.skills.length, 15);
    assert.equal(t.styles.length, 8);
    assert.equal(t.formats.length, 4);
    assert.ok(t.tools.length >= 17);
    assert.ok(t.languages.some((l) => l.id === 'Hindi'));
    assert.deepEqual(t.categories.map((c) => c.id), CATEGORY_IDS);
    assert.ok(t.categories.every((c) => c.label && c.description), 'categories carry a rail description');
  });
});

describe('per-role sign-up (§6.1)', () => {
  test('creator: category + city are required and stored on the profile', async () => {
    const missing = await register({ ...account('c1@example.com'), role: 'creator' });
    assert.equal(missing.status, 400);
    assert.ok(fields(missing).includes('category'));
    assert.ok(fields(missing).includes('city'));

    const ok = await register({ ...account('c2@example.com'), role: 'creator', category: 'animator', city: 'Chennai', displayName: 'tara.animates' });
    assert.equal(ok.status, 201);
    const profile = await CreatorProfile.findOne({ userId: ok.body.data.user._id }).lean();
    assert.equal(profile.category, 'animator');
    assert.equal(profile.location, 'Chennai');
    assert.equal(profile.displayName, 'tara.animates');
  });

  test('creator display name defaults to the full name', async () => {
    const res = await register({ ...account('c3@example.com'), ...registerFields('creator') });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.profile.displayName, 'Kavya Nair');
  });

  test('unknown taxonomy ids are rejected (no free text)', async () => {
    const creator = await register({ ...account('c4@example.com'), role: 'creator', category: 'AI Video', city: 'Pune' });
    assert.equal(creator.status, 400);
    assert.ok(fields(creator).includes('category'));
    const brand = await register({ ...account('b0@example.com'), ...registerFields('brand'), industry: 'Food & Beverage' });
    assert.equal(brand.status, 400);
    assert.ok(fields(brand).includes('industry'));
  });

  test('brand: job title, company and industry id; person name kept separately; website normalised', async () => {
    const missing = await register({ ...account('b1@example.com'), role: 'brand' });
    assert.equal(missing.status, 400);
    for (const f of ['jobTitle', 'companyName', 'industry']) assert.ok(fields(missing).includes(f), f);

    const res = await register({
      ...account('b2@example.com'),
      role: 'brand',
      jobTitle: 'Marketing manager',
      companyName: 'Masala Trail Foods',
      industry: 'food',
      websiteUrl: 'masalatrail.in',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.name, 'Kavya Nair');
    const p = res.body.data.profile;
    assert.equal(p.accountType, 'brand');
    assert.equal(p.companyName, 'Masala Trail Foods');
    assert.equal(p.contactName, 'Kavya Nair');
    assert.equal(p.jobTitle, 'Marketing manager');
    assert.ok(SPECIALIZATION_IDS.includes(p.industry));
    assert.equal(p.websiteUrl, 'https://masalatrail.in');
    assert.deepEqual(p.clients, []);
  });

  test('agency: role brand + accountType agency, team size + website required, first client becomes clients[0]', async () => {
    const missing = await register({ ...account('a1@example.com'), role: 'brand', accountType: 'agency', jobTitle: 'Founder', companyName: 'Pixel & Pine Studio' });
    assert.equal(missing.status, 400);
    assert.ok(fields(missing).includes('teamSize'));
    assert.ok(fields(missing).includes('websiteUrl'));

    const res = await register({
      ...account('a2@example.com'),
      ...registerFields('agency'),
      companyName: 'Pixel & Pine Studio',
      firstClientName: 'Verdant Skin Co.',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'brand', 'agencies keep the brand role so brand guards apply');
    const p = await BrandProfile.findOne({ userId: res.body.data.user._id }).lean();
    assert.equal(p.accountType, 'agency');
    assert.equal(p.teamSize, '2-10');
    assert.equal(p.clients.length, 1);
    assert.equal(p.clients[0].name, 'Verdant Skin Co.');
    assert.equal(p.clients[0].initials, 'VS');

    const noClient = await register({ ...account('a3@example.com'), ...registerFields('agency') });
    assert.equal(noClient.status, 201);
    assert.deepEqual(noClient.body.data.profile.clients, []);
  });

  test('server decides the role: reviewer and unknown roles are rejected, extra fields are stripped', async () => {
    for (const role of ['reviewer', 'admin', undefined]) {
      const res = await register({ ...account(`r-${role}@example.com`), role, category: 'video', city: 'Pune' });
      assert.equal(res.status, 400, `role ${role}`);
    }
    const sneaky = await register({ ...account('s@example.com'), ...registerFields('creator'), isDemo: true, featured: true });
    assert.equal(sneaky.status, 201);
    const p = await CreatorProfile.findOne({ userId: sneaky.body.data.user._id }).lean();
    assert.equal(p.isDemo, false);
    assert.equal(p.featured, false);
  });
});
