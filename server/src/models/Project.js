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

/** Written by the brand once, after the project is completed. Never seeded or generated. */
const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
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
    feedback: { type: feedbackSchema, default: undefined },
  },
  schemaOptions,
);

projectSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

export const Project = mongoose.model('Project', projectSchema, 'projects');
