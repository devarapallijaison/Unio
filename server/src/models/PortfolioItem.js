import mongoose from 'mongoose';
import { MEDIA_TYPES, schemaOptions, stringList, urlField } from './enums.js';
import { CONTENT_TYPE_IDS, FORMAT_IDS, SKILL_IDS, SPECIALIZATION_IDS, STYLE_IDS } from './taxonomy.js';

/** One step of "How it was made" (guide §5.5). Ordered. */
const workflowStep = new mongoose.Schema(
  {
    tool: { type: String, required: true, trim: true, maxlength: 40 },
    version: { type: String, trim: true, maxlength: 30 },
    generations: { type: Number, min: 0, max: 100000 },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const versionSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, maxlength: 30 },
    mediaUrl: urlField(),
    thumbnailUrl: urlField(),
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['changes', 'approved'] },
  },
  { _id: false },
);

const portfolioItemSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    mediaType: { type: String, enum: MEDIA_TYPES, default: 'image' },
    mediaUrl: urlField('Media URL is required'),
    thumbnailUrl: urlField(),
    tools: stringList,
    category: { type: String, trim: true, maxlength: 80, default: '', index: true }, // Round 1 free text
    featured: { type: Boolean, default: false, index: true },

    /* How it was made (Round 2) */
    contentType: { type: String, enum: CONTENT_TYPE_IDS },
    format: { type: String, enum: FORMAT_IDS },
    industry: { type: String, enum: SPECIALIZATION_IDS },
    skills: { type: [{ type: String, enum: SKILL_IDS }], default: [], index: true },
    styles: { type: [{ type: String, enum: STYLE_IDS }], default: [] },
    workflow: { type: [workflowStep], default: [] },
    generations: { type: Number, min: 0, max: 100000 },
    versionsCount: { type: Number, min: 1, max: 50 },
    timeTakenDays: { type: Number, min: 0, max: 365 },
    durationSec: { type: Number, min: 0, max: 36000 },
    briefSummary: { type: String, trim: true, maxlength: 500, default: '' },
    deliveredSummary: { type: String, trim: true, maxlength: 500, default: '' },
    versions: { type: [versionSchema], default: [] },
    licence: {
      licensedTo: { type: String, trim: true, maxlength: 160 },
      summary: { type: String, trim: true, maxlength: 300 },
      notForLicensing: { type: Boolean, default: false },
    },

    /* Server-controlled (never from the client) */
    madeOnUnio: { type: Boolean, default: false },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    contentHash: { type: String, index: true, sparse: true },
  },
  schemaOptions,
);

portfolioItemSchema.index({ creatorId: 1, featured: -1 });

export const PortfolioItem = mongoose.model('PortfolioItem', portfolioItemSchema, 'portfolioItems');
