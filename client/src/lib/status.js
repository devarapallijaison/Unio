/** Display labels and tones for every status enum in the schema. */
const LABELS = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
  declined: 'Declined',
  cancelled: 'Cancelled',
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  completed: 'Completed',
  approved: 'Approved',
  available: 'Available',
  busy: 'Limited availability',
  unavailable: 'Not taking work',
  SELF_REPORTED: 'Self-reported',
  PENDING: 'Pending review',
  VERIFIED: 'Verified',
  REJECTED: 'Not verified',
};

const TONES = {
  positive: ['open', 'accepted', 'approved', 'completed', 'available', 'VERIFIED'],
  active: ['in_progress', 'submitted'],
  waiting: ['pending', 'not_started', 'busy', 'PENDING'],
  attention: ['revision_requested', 'REJECTED'],
  neutral: ['draft', 'closed', 'rejected', 'withdrawn', 'declined', 'cancelled', 'unavailable', 'SELF_REPORTED'],
};

export function statusLabel(status) {
  return LABELS[status] ?? status;
}

export function statusTone(status) {
  return Object.keys(TONES).find((tone) => TONES[tone].includes(status)) ?? 'neutral';
}
