import mongoose from 'mongoose';
import { CHECK_RESULTS, VERIFICATION_METHODS, VERIFICATION_STATUS, VERIFICATION_TYPES, schemaOptions, urlField } from './enums.js';

/**
 * A creator's claim about a tool, an AI workflow or a portfolio piece, plus the evidence for it.
 * Status flow: SELF_REPORTED → PENDING (creator submits evidence) → VERIFIED | REJECTED (reviewer only).
 */
const verificationSubmissionSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, index: true },
    type: { type: String, enum: VERIFICATION_TYPES, required: true },
    // Normalised identity used to prevent duplicate claims, e.g. "tool:kling", "portfolio:<itemId>".
    key: { type: String, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    portfolioItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'PortfolioItem' },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    evidenceUrls: { type: [urlField()], default: [] },
    status: { type: String, enum: VERIFICATION_STATUS, default: 'SELF_REPORTED', index: true },
    submittedAt: { type: Date },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
    reviewedAt: { type: Date },
    // F5 (guide §5.9). Challenge: one-time code the creator types on screen while recording (48 h, one use).
    method: { type: String, enum: VERIFICATION_METHODS },
    challengeCode: { type: String },
    challengeIssuedAt: { type: Date },
    challengeExpiresAt: { type: Date },
    challengeUsedAt: { type: Date },
    recordingUrl: urlField(),
    screenshotUrls: { type: [urlField()], default: [] },
    certificate: { issuer: { type: String, trim: true, maxlength: 120 }, title: { type: String, trim: true, maxlength: 160 }, verifyUrl: urlField(), fileUrl: urlField() },
    // "Automatic pre-checks": hints for the reviewer, never a decision.
    checks: {
      type: [{ id: String, label: String, result: { type: String, enum: CHECK_RESULTS }, detail: String, _id: false }],
      default: [],
    },
    flagged: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  schemaOptions,
);

verificationSubmissionSchema.index({ creatorId: 1, key: 1 }, { unique: true });
verificationSubmissionSchema.index({ status: 1, submittedAt: 1 });
verificationSubmissionSchema.index({ recordingUrl: 1 }, { sparse: true });
verificationSubmissionSchema.index({ 'certificate.verifyUrl': 1 }, { sparse: true });

export const VerificationSubmission = mongoose.model(
  'VerificationSubmission',
  verificationSubmissionSchema,
  'verificationSubmissions',
);
