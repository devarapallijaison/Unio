import { BadgeCheck, Clock3 } from 'lucide-react';
import { ToolChip, toolState } from '../ui/Trust.jsx';

const COPY = {
  VERIFIED: 'Verified by a UNIO reviewer against submitted evidence.',
  PENDING: 'Evidence submitted and waiting for a UNIO reviewer.',
  SELF_REPORTED: 'Listed by the creator. Not independently checked.',
};

/** Compact verification marker. Only VERIFIED gets the check icon; nothing else implies verification. */
export function VerificationBadge({ status, compact = false, className = '' }) {
  if (status === 'VERIFIED') {
    return (
      <span title={COPY.VERIFIED} className={`inline-flex items-center gap-1 text-[12px] font-semibold text-ok ${className}`}>
        <BadgeCheck className="size-3.5" strokeWidth={2} aria-hidden />
        {compact ? <span className="sr-only">Verified</span> : 'Verified'}
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span title={COPY.PENDING} className={`inline-flex items-center gap-1 text-[12px] font-semibold text-wait ${className}`}>
        <Clock3 className="size-3.5" strokeWidth={1.8} aria-hidden />
        {compact ? <span className="sr-only">Pending review</span> : 'Pending review'}
      </span>
    );
  }
  if (compact) return null;
  return (
    <span title={COPY.SELF_REPORTED} className={`text-[12px] text-steel ${className}`}>
      Self-reported
    </span>
  );
}

/** Tool name with its trust state — the v9 tool chip. */
export function ToolTag({ name, status }) {
  return <ToolChip name={name} state={toolState(status)} />;
}

export const VERIFICATION_LEGEND = COPY;
