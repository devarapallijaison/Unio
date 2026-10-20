import bcrypt from 'bcryptjs';
import { BrandProfile, CreatorProfile, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { publicUser } from './serializers.js';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('unio-timing-equaliser', BCRYPT_ROUNDS);

export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function getProfileForUser(user) {
  if (!user || user.role === 'reviewer') return null;
  const Model = user.role === 'creator' ? CreatorProfile : BrandProfile;
  return Model.findOne({ userId: user._id }).lean();
}

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Profile document for a new account. Fields come from the per-role register schema (validators). */
function profileFor(userId, body) {
  if (body.role === 'creator') {
    return {
      Model: CreatorProfile,
      doc: { userId, displayName: body.displayName || body.name, category: body.category, location: body.city },
    };
  }
  const doc = {
    userId,
    companyName: body.companyName,
    accountType: body.accountType,
    contactName: body.name,
    jobTitle: body.jobTitle,
    websiteUrl: body.websiteUrl || undefined,
  };
  if (body.accountType === 'agency') {
    doc.teamSize = body.teamSize;
    if (body.firstClientName) doc.clients = [{ name: body.firstClientName, initials: initialsOf(body.firstClientName) }];
  } else {
    doc.industry = body.industry;
  }
  return { Model: BrandProfile, doc };
}

export async function register(body) {
  const { name, email, password, role } = body;
  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const user = await User.create({ name, email, role, passwordHash: await hashPassword(password) });

  try {
    const { Model, doc } = profileFor(user._id, body);
    await Model.create(doc);
  } catch (err) {
    // Keep users and profiles consistent: never leave a user without a profile.
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  const lean = user.toObject();
  return { user: publicUser(lean), profile: await getProfileForUser(lean) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash').lean();
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return { user: publicUser(user), profile: await getProfileForUser(user) };
}
