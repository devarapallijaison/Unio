import mongoose from 'mongoose';
import { CAMPAIGN_STATUS, schemaOptions, stringList } from './enums.js';
import { CONTENT_TYPE_IDS, DURATION_MONTHS, FORMAT_IDS, LIKENESS_IDS, PORTFOLIO_ALLOWED_IDS, REGION_IDS, USAGE_IDS } from './taxonomy.js';

const deliverableSpecSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false },
);

/** F7 — the rights questions every brief answers. Required before a campaign can be opened (services). */
const rightsSchema = new mongoose.Schema(
  {
    usage: { type: [{ type: String, enum: USAGE_IDS }], default: [] },
    region: { type: String, enum: REGION_IDS },
    regionNote: { type: String, trim: true, maxlength: 120 },
    durationMonths: { type: Number, enum: DURATION_MONTHS }, // 0 = perpetual
    exclusive: { type: Boolean },
    portfolioAllowed: { type: String, enum: PORTFOLIO_ALLOWED_IDS, default: 'after_launch' },
    commerciallySafeTools: { type: Boolean, default: true },
    aiLabel: { type: Boolean, default: true },
    likeness: { type: String, enum: LIKENESS_IDS, default: 'none' },
  },
  { _id: false },
);

const campaignSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    brief: { type: String, required: true, trim: true, maxlength: 5000 },
    // Specialization id from Round 2 (models/taxonomy.js). Round 1 rows may hold free text until migrated.
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    budgetMin: { type: Number, min: 0 },
    budgetMax: { type: Number, min: 0 },
    deadline: { type: Date },
    requiredSkills: stringList,
    requiredTools: stringList,
    deliverables: { type: [deliverableSpecSchema], default: [] },
    status: { type: String, enum: CAMPAIGN_STATUS, default: 'draft', index: true },

    /* Round 2 (F3 + F7) */
    contentType: { type: String, enum: CONTENT_TYPE_IDS },
    formats: { type: [{ type: String, enum: FORMAT_IDS }], default: [] },
    style: { type: String, trim: true, maxlength: 300, default: '' },
    languages: stringList,
    lengthNote: { type: String, trim: true, maxlength: 80, default: '' },
    revisionsIncluded: { type: Number, min: 0, max: 5, default: 2 },
    sourcePortfolioItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'PortfolioItem' },
    aiFilledFields: { type: [String], default: [] },
    rights: { type: rightsSchema, default: () => ({}) },
  },
  schemaOptions,
);

campaignSchema.pre('validate', function checkBudget() {
  if (this.budgetMin != null && this.budgetMax != null && this.budgetMax < this.budgetMin) {
    this.invalidate('budgetMax', 'Maximum budget must be greater than or equal to minimum budget');
  }
});

campaignSchema.index({ requiredSkills: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ status: 1, contentType: 1 });

export const Campaign = mongoose.model('Campaign', campaignSchema, 'campaigns');
