import mongoose from 'mongoose';
import { MEDIA_TYPES, schemaOptions, stringList, urlField } from './enums.js';

const portfolioItemSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'image' },
    mediaUrl: urlField('Media URL is required'),
    thumbnailUrl: urlField(),
    tools: stringList,
    category: { type: String, trim: true, maxlength: 80, default: '', index: true },
    featured: { type: Boolean, default: false, index: true },
  },
  schemaOptions,
);

export const PortfolioItem = mongoose.model('PortfolioItem', portfolioItemSchema, 'portfolioItems');
