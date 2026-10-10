export const ROLES = ['creator', 'brand'];
export const AVAILABILITY = ['available', 'busy', 'unavailable'];
export const MEDIA_TYPES = ['image', 'video'];
export const CAMPAIGN_STATUS = ['draft', 'open', 'closed'];
export const APPLICATION_STATUS = ['pending', 'accepted', 'rejected', 'withdrawn'];
export const INVITATION_STATUS = ['pending', 'accepted', 'declined', 'cancelled'];
export const PROJECT_STATUS = ['not_started', 'in_progress', 'submitted', 'revision_requested', 'completed', 'cancelled'];
export const DELIVERABLE_STATUS = ['pending', 'submitted', 'approved', 'revision_requested'];
export const SOURCE_TYPES = ['application', 'invitation'];

export const schemaOptions = { timestamps: true, versionKey: false };

const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

export const urlField = (requiredMsg) => ({
  type: String,
  trim: true,
  ...(requiredMsg ? { required: [true, requiredMsg] } : {}),
  validate: { validator: (v) => !v || URL_RE.test(v), message: 'Must be a valid http(s) URL' },
});

export const stringList = { type: [{ type: String, trim: true }], default: [] };
