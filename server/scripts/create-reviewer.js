/**
 * Provision a verification reviewer. The reviewer role cannot be chosen at sign-up.
 *
 *   npm run create-reviewer -- reviewer@yourdomain.com "Reviewer Name"
 *
 * Password comes from REVIEWER_PASSWORD (env or server/.env); it is never hardcoded.
 * Existing creator/brand accounts are not converted: use a dedicated email for reviewers.
 */
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/index.js';
import { hashPassword } from '../src/services/auth.service.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ') || 'UNIO Reviewer';
const password = process.env.REVIEWER_PASSWORD;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run create-reviewer -- <email> [name]');
  process.exit(1);
}
if (!password || password.length < 8) {
  console.error('Set REVIEWER_PASSWORD (min 8 characters) in server/.env or the environment.');
  process.exit(1);
}

try {
  await connectDB();
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized }).lean();
  if (existing && existing.role !== 'reviewer') {
    console.error(`${normalized} is already a ${existing.role} account. Use a separate email for reviewers.`);
    process.exitCode = 1;
  } else {
    await User.updateOne(
      { email: normalized },
      { $set: { name, role: 'reviewer', passwordHash: await hashPassword(password) }, $setOnInsert: { email: normalized } },
      { upsert: true },
    );
    console.log(`${existing ? 'Updated' : 'Created'} reviewer ${normalized}. Sign in at /login, then open /review.`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
