import mongoose from 'mongoose';
import { schemaOptions, urlField } from './enums.js';
import { SPECIALIZATION_IDS, TEAM_SIZE_IDS } from './taxonomy.js';

export const ACCOUNT_TYPES = ['brand', 'agency'];

/** An agency's client (guide §5.4). Agencies are role 'brand' with accountType 'agency'. */
const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    industry: { type: String, enum: SPECIALIZATION_IDS },
    initials: { type: String, trim: true, maxlength: 3 },
    color: { type: String, trim: true, maxlength: 20 },
    approverName: { type: String, trim: true, maxlength: 120 },
    approverEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
    archived: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true },
);

const brandProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    accountType: { type: String, enum: ACCOUNT_TYPES, default: 'brand', index: true },
    contactName: { type: String, trim: true, maxlength: 120 },
    jobTitle: { type: String, trim: true, maxlength: 80 },
    teamSize: { type: String, enum: TEAM_SIZE_IDS },
    logoUrl: urlField(),
    websiteUrl: urlField(),
    // Round 2 sign-ups store a specialization id; Round 1 profiles keep free text until Phase 5 (B8).
    industry: { type: String, trim: true, maxlength: 80, default: '', index: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    clients: { type: [clientSchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions,
);

export const BrandProfile = mongoose.model('BrandProfile', brandProfileSchema, 'brandProfiles');
