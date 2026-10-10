import { statusLabel, statusTone } from '../../lib/status.js';

const TONE_CLASSES = {
  positive: 'bg-mint text-forest border-sage',
  active: 'bg-sage/60 text-ink border-sage',
  waiting: 'bg-sand text-ink border-beige',
  attention: 'bg-sand text-[#6b4b1f] border-beige',
  neutral: 'bg-white text-muted border-beige/80',
};

const DOT = {
  positive: 'bg-forest',
  active: 'bg-forest/70',
  waiting: 'bg-beige',
  attention: 'bg-[#a87b3a]',
  neutral: 'bg-muted/50',
};

export function StatusPill({ status, className = '' }) {
  const tone = statusTone(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[12px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

export function Tag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-sm border border-beige/80 bg-white/60 px-2 py-0.5 text-[12px] text-ink/80 ${className}`}>
      {children}
    </span>
  );
}

export function DemoBadge({ className = '', label = 'Demo profile' }) {
  return (
    <span
      title="Fictional profile created to demonstrate the marketplace. Work shown is not real client work."
      className={`inline-flex items-center rounded-sm border border-dashed border-beige bg-ivory px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted ${className}`}
    >
      {label}
    </span>
  );
}
