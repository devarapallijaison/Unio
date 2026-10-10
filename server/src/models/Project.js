import mongoose from 'mongoose';
import { DELIVERABLE_STATUS, PROJECT_STATUS, SOURCE_TYPES, schemaOptions, urlField } from './enums.js';

const deliverableSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    dueDate: { type: Date },
    mediaUrl: urlField(),
    status: { type: String, enum: DELIVERABLE_STATUS, default: 'pending' },
  },
  { timestamps: true },
);

const projectSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: PROJECT_STATUS, default: 'not_started', index: true },
    deliverables: { type: [deliverableSchema], default: [] },
  },
  schemaOptions,
);

projectSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

export const Project = mongoose.model('Project', projectSchema, 'projects');
