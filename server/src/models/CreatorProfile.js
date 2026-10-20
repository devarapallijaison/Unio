import mongoose from 'mongoose';
import { AVAILABILITY, schemaOptions, stringList, urlField } from './enums.js';
import { CATEGORY_IDS } from './taxonomy.js';

const creatorProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    photoUrl: urlField(),
    location: { type: String, trim: true, maxlength: 120, default: '' },
    // Main creator category (taxonomy id). Set at sign-up from Round 2; Round 1 profiles may not have one.
    category: { type: String, enum: CATEGORY_IDS },
    skills: stringList,
    tools: stringList,
    specialties: stringList,
    startingPrice: { type: Number, min: 0 },
    availability: { type: String, enum: AVAILABILITY, default: 'available' },
    featured: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions,
);

creatorProfileSchema.index({ category: 1 });
creatorProfileSchema.index({ skills: 1 });
creatorProfileSchema.index({ tools: 1 });
creatorProfileSchema.index({ specialties: 1 });
creatorProfileSchema.index({ availability: 1 });
creatorProfileSchema.index({ featured: 1 });

export const CreatorProfile = mongoose.model('CreatorProfile', creatorProfileSchema, 'creatorProfiles');
