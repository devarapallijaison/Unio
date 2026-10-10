import mongoose from 'mongoose';
import { INVITATION_STATUS, schemaOptions } from './enums.js';

const invitationSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: INVITATION_STATUS, default: 'pending', index: true },
  },
  schemaOptions,
);

invitationSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

export const Invitation = mongoose.model('Invitation', invitationSchema, 'invitations');
