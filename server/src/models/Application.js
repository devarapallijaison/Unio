import mongoose from 'mongoose';
import { APPLICATION_STATUS, schemaOptions } from './enums.js';

const applicationSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    proposal: { type: String, required: true, trim: true, maxlength: 3000 },
    proposedPrice: { type: Number, min: 0 },
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending', index: true },
    submittedAt: { type: Date, default: Date.now },
  },
  schemaOptions,
);

applicationSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema, 'applications');
