import mongoose from 'mongoose';
import { DELIVERABLE_STATUS, PROJECT_STATUS, SOURCE_TYPES, schemaOptions, stringList, urlField } from './enums.js';

export const VERSION_STATUS = ['submitted', 'changes_requested', 'approved'];

/** One submitted version of a deliverable (F6). Versions are append-only; only status/feedback change. */
const versionSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true },
    mediaUrl: urlField('Media link is required'),
    thumbnailUrl: urlField(),
    changeNote: { type: String, trim: true, maxlength: 1000, required: true },
    toolsUsed: stringList,
    status: { type: String, enum: VERSION_STATUS, default: 'submitted' },
    feedback: {
      type: new mongoose.Schema(
        {
          note: { type: String, trim: true, maxlength: 2000, default: '' },
          byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          byName: String,
          byRole: { type: String, enum: ['brand', 'client'] },
          at: Date,
        },
        { _id: false },
      ),
      default: undefined,
    },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const deliverableSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    specNote: { type: String, trim: true, maxlength: 200, default: '' },
    dueDate: { type: Date },
    // mediaUrl + status mirror the latest version so Round 1 code keeps working.
    mediaUrl: urlField(),
    status: { type: String, enum: DELIVERABLE_STATUS, default: 'pending' },
    versions: { type: [versionSchema], default: [] },
    currentVersion: { type: Number, default: 0 },
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

/** Plain-language rights summary issued on completion (F7). Not a legal contract. */
const rightsCardSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    validFrom: Date,
    validTo: Date, // null when perpetual
    summary: String,
    toolsUsed: [String],
    creatorName: String,
    brandName: String,
    clientName: String,
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
    revisionsIncluded: { type: Number, min: 0, default: 2 },
    revisionsUsed: { type: Number, min: 0, default: 0 },
    // Copy of campaign.rights at creation: later campaign edits never change a live project.
    rightsSnapshot: { type: mongoose.Schema.Types.Mixed, default: undefined },
    rightsCard: { type: rightsCardSchema, default: undefined },
    completedAt: Date,
    lastMessageAt: Date,
  },
  schemaOptions,
);

projectSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });
projectSchema.index({ 'rightsCard.number': 1 }, { unique: true, sparse: true });

export const Project = mongoose.model('Project', projectSchema, 'projects');
