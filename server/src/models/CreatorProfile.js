import mongoose from 'mongoose';
import { AVAILABILITY, schemaOptions, stringList, urlField } from './enums.js';
import { CATEGORY_IDS, CONTENT_TYPE_IDS, FORMAT_IDS, SPECIALIZATION_IDS, STYLE_IDS } from './taxonomy.js';

const idList = (ids) => ({ type: [{ type: String, enum: ids }], default: [] });

const howIWorkStep = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 60 },
    detail: { type: String, trim: true, maxlength: 160, default: '' },
  },
  { _id: false },
);

const creatorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    headline: { type: String, trim: true, maxlength: 140, default: '' },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    photoUrl: urlField(),
    location: { type: String, trim: true, maxlength: 120, default: '' },

    /* What you make — controlled lists (models/taxonomy.js). */
    category: { type: String, enum: CATEGORY_IDS },
    secondaryCategories: idList(CATEGORY_IDS), // max 2 (validator)
    contentTypes: idList(CONTENT_TYPE_IDS),
    specializations: idList(SPECIALIZATION_IDS),
    styles: idList(STYLE_IDS),
    formats: idList(FORMAT_IDS),
    languages: stringList,
    // Skill ids from Round 2 on. Round 1 free-text values may remain on old profiles; they are never shown
    // publicly (a skill only shows when a portfolio piece proves it).
    skills: stringList,
    tools: stringList,
    specialties: stringList, // Round 1 free text — kept for old data, no longer written
    workflow: { type: [{ type: String, trim: true, maxlength: 40 }], default: [] }, // default tool chain, ordered
    howIWork: { type: [howIWorkStep], default: [] }, // max 6 (validator)

    startingPrice: { type: Number, min: 0 },
    turnaroundDays: { type: Number, min: 1, max: 60 },
    revisionsIncluded: { type: Number, min: 0, max: 10, default: 2 },
    commerciallySafe: { type: Boolean, default: false },
    availability: { type: String, enum: AVAILABILITY, default: 'available' },
    featured: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },

    /* Denormalised trust — written only by services/trust.service.js, never by the client. */
    verifiedTools: stringList,
    certifiedTools: stringList,
    pendingTools: stringList,
    madeOnUnioCount: { type: Number, default: 0 },
    ratingAvg: { type: Number },
    ratingCount: { type: Number, default: 0 },
    trustLevel: { type: Number, min: 1, max: 5, default: 1 },
  },
  schemaOptions,
);

for (const field of ['category', 'secondaryCategories', 'contentTypes', 'specializations', 'skills', 'tools', 'verifiedTools', 'styles', 'languages', 'startingPrice', 'trustLevel', 'specialties', 'availability', 'featured']) {
  creatorProfileSchema.index({ [field]: 1 });
}

export const CreatorProfile = mongoose.model('CreatorProfile', creatorProfileSchema, 'creatorProfiles');
