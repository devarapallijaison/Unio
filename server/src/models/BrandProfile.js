import mongoose from 'mongoose';
import { schemaOptions, urlField } from './enums.js';

const brandProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 160 },
    logoUrl: urlField(),
    websiteUrl: urlField(),
    industry: { type: String, trim: true, maxlength: 80, default: '', index: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions,
);

export const BrandProfile = mongoose.model('BrandProfile', brandProfileSchema, 'brandProfiles');
