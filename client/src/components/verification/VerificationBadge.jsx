import { BadgeCheck, Clock3 } from 'lucide-react';

const COPY = {
  VERIFIED: 'Verified by a UNIO reviewer against submitted evidence.',
  PENDING: 'Evidence submitted and waiting for a UNIO reviewer.',
  SELF_REPORTED: 'Listed by the creator. Not independently checked.',
};

/** Compact verification marker. Only VERIFIED gets the check icon; nothing else implies verification. */
export function VerificationBadge({ status, compact = false, className = '' }) {
  if (status === 'VERIFIED') {
    return (
      <span title={COPY.VERIFIED} className={`inline-flex items-center gap-1 text-[12px] font-medium text-forest ${className}`}>
        <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />
        {compact ? <span className="sr-only">Verified</span> : 'Verified'}
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span title={COPY.PENDING} className={`inline-flex items-center gap-1 text-[12px] text-muted ${className}`}>
        <Clock3 className="size-3.5" strokeWidth={1.75} aria-hidden />
        {compact ? <span className="sr-only">Pending review</span> : 'Pending review'}
      </span>
    );
  }
  if (compact) return null;
  return (
    <span title={COPY.SELF_REPORTED} className={`text-[12px] text-muted ${className}`}>
      Self-reported
    </span>
  );
}

/** Tool tag with an inline status marker. */
export function ToolTag({ name, status }) {
  const verified = status === 'VERIFIED';
  return (
    <span
      title={COPY[status] ?? COPY.SELF_REPORTED}
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[12px] ${
        verified ? 'border-sage bg-mint text-forest' : 'border-beige/80 bg-white/60 text-ink/80'
      }`}
    >
      {name}
      {verified && <BadgeCheck className="size-3.5" strokeWidth={2} aria-label="Verified" />}
      {status === 'PENDING' && <Clock3 className="size-3 text-muted" strokeWidth={1.75} aria-label="Pending review" />}
    </span>
  );
}

export const VERIFICATION_LEGEND = COPY;
