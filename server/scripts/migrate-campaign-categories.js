/**
 * One-off migration: Round 1 free-text campaign categories → specialization ids (guide §5.1, confirmed mapping).
 *
 *   npm --prefix server run migrate:categories            dry run (prints what would change, writes nothing)
 *   npm --prefix server run migrate:categories -- --apply write the changes
 *
 * Only known values are mapped (Beauty→beauty, Food & Beverage→food, Electronics/Tech→tech,
 * Wellness/Lifestyle/Hospitality→d2c, …). Anything else is left untouched and listed, so the brand
 * picks an industry the next time they edit the campaign. Nothing is deleted.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Campaign } from '../src/models/index.js';
import { SPECIALIZATION_IDS } from '../src/models/taxonomy.js';
import { toSpecialization } from '../src/services/briefBuilder.service.js';

const apply = process.argv.includes('--apply');

try {
  await connectDB();
  const legacy = await Campaign.find({ category: { $nin: SPECIALIZATION_IDS } }, 'title category').lean();
  const changes = [];
  const unknown = [];
  for (const c of legacy) {
    const id = toSpecialization(c.category);
    if (id) changes.push({ _id: c._id, title: c.title, from: c.category, to: id });
    else unknown.push({ title: c.title, category: c.category });
  }

  console.log(`${legacy.length} campaign(s) with a Round 1 category · ${changes.length} mappable · ${unknown.length} left for the brand`);
  for (const ch of changes) console.log(`  ${ch.from.padEnd(18)} → ${ch.to.padEnd(10)} ${ch.title}`);
  for (const u of unknown) console.log(`  (unmapped) ${u.category} — ${u.title}`);

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to update.');
  } else if (changes.length) {
    const res = await Campaign.bulkWrite(
      // Conditional on the old value so a re-run (or a concurrent edit) never overwrites a newer choice.
      changes.map((ch) => ({ updateOne: { filter: { _id: ch._id, category: ch.from }, update: { $set: { category: ch.to } } } })),
    );
    console.log(`\nUpdated ${res.modifiedCount} campaign(s).`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
