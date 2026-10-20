import { Sparkles } from 'lucide-react';
import { statusLabel, statusTone } from '../../lib/status.js';

/** v9 .pill tones. Functional colours appear only for status. */
const PILL_TONES = {
  ok: 'bg-ok-bg text-ok border-ok-ln',
  wait: 'bg-wait-bg text-wait border-wait-ln',
  att: 'bg-att-bg text-att border-att-ln',
  info: 'bg-info-bg text-info border-info-ln',
  neutral: 'bg-[#e8ebeb] text-slate border-line2',
  dark: 'bg-navy text-white border-navy',
  ai: 'bg-ai-bg text-ai border-ai-ln',
};

export function Pill({ tone = 'neutral', dot = true, children, className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${PILL_TONES[tone] ?? PILL_TONES.neutral} ${className}`}
      {...props}
    >
      {dot && <i className="inline-block size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

/** Status enum → labelled pill (labels and tones live in lib/status.js). */
export function StatusPill({ status, className = '' }) {
  return (
    <Pill tone={statusTone(status)} className={className}>
      {statusLabel(status)}
    </Pill>
  );
}

/** Small square tag (v9 .tag) for deliverables, dates, skills. */
export function Tag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-line bg-white px-2 py-0.5 text-[12px] text-slate ${className}`}>
      {children}
    </span>
  );
}

/** Marks fictional seeded profiles (v9 .demo). */
export function DemoBadge({ className = '', label = 'Demo profile' }) {
  return (
    <span
      title="Fictional profile created to demonstrate the marketplace. Work shown is not real client work."
      className={`inline-flex items-center rounded-[3px] border border-dashed border-line2 px-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-steel ${className}`}
    >
      {label}
    </span>
  );
}

/** Mono "AI" tag for anything AI-generated or AI-filled (v9 .ai-mark). */
export function AiMark({ label = 'AI', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border border-ai-ln bg-ai-bg px-[5px] py-px font-mono text-[10px] tracking-[0.08em] text-ai ${className}`}>
      <Sparkles className="size-2.5" aria-hidden />
      {label}
    </span>
  );
}
