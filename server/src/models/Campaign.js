import mongoose from 'mongoose';
import { CAMPAIGN_STATUS, schemaOptions, stringList } from './enums.js';

const deliverableSpecSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false },
);

const campaignSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    brief: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    budgetMin: { type: Number, min: 0 },
    budgetMax: { type: Number, min: 0 },
    deadline: { type: Date },
    requiredSkills: stringList,
    requiredTools: stringList,
    deliverables: { type: [deliverableSpecSchema], default: [] },
    status: { type: String, enum: CAMPAIGN_STATUS, default: 'draft', index: true },
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

export const Campaign = mongoose.model('Campaign', campaignSchema, 'campaigns');
