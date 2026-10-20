import { Check, Clock3, Paperclip } from 'lucide-react';

/**
 * UNIO Trust display pieces (guide §3.4, F5). These only render what they are given —
 * callers must pass states that come from real verification records.
 */

const CHIP = {
  verified: { cls: 'bg-navy text-white border-navy', Icon: Check, iconCls: 'text-ok-ln', title: 'Verified by UNIO' },
  certified: { cls: 'bg-white text-navy border-navy', Icon: Paperclip, iconCls: '', title: 'Certificate checked' },
  pending: { cls: 'bg-wait-bg text-wait border-wait-ln', Icon: Clock3, iconCls: '', title: 'Review pending' },
  self: { cls: 'bg-white text-steel border-line2', Icon: null, iconCls: '', title: 'Self-reported' },
};

/** Round 1 claim status → chip state. Anything not reviewed reads as self-reported. */
export function toolState(status) {
  if (status === 'VERIFIED') return 'verified';
  if (status === 'CERTIFIED') return 'certified';
  if (status === 'PENDING') return 'pending';
  return 'self';
}

/** Tool name with its trust state (v9 .tc). */
export function ToolChip({ name, state = 'self', className = '' }) {
  const { cls, Icon, iconCls, title } = CHIP[state] ?? CHIP.self;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[6px] border px-[9px] py-[3px] text-[12px] font-semibold ${cls} ${className}`}
    >
      {Icon && <Icon className={`size-3 ${iconCls}`} strokeWidth={2.4} aria-hidden />}
      {name}
      <span className="sr-only"> — {title}</span>
    </span>
  );
}

/** "★ Made on UNIO · N" — only for counts of completed UNIO projects. */
export function MadeOnUnio({ count, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[6px] border border-ink bg-[linear-gradient(120deg,var(--color-ink),var(--color-slate))] px-[9px] py-[3px] text-[12px] font-semibold text-white ${className}`}
    >
      <b className="text-gold-lt">★ Made on UNIO</b>
      {count != null && <span>· {count}</span>}
    </span>
  );
}

const CHAIN_STEP = {
  light: { plain: 'border-line bg-[#eef1f1] text-slate', verified: 'border-ok-ln bg-ok-bg text-ok', arrow: 'text-mist' },
  dark: { plain: 'border-slate bg-white/[0.06] text-bone', verified: 'border-ok-ln/40 bg-ok-ln/15 text-ok-ln', arrow: 'text-steel' },
};

/** Workflow as connected pills: Midjourney → Kling ✓ → Runway ✓ (v9 .chain). `dark` for navy/ink surfaces. */
export function ToolChain({ steps = [], dark = false, className = '' }) {
  if (!steps.length) return null;
  const tone = dark ? CHAIN_STEP.dark : CHAIN_STEP.light;
  return (
    <div className={`flex flex-wrap items-center gap-1 text-[12px] font-semibold ${className}`}>
      {steps.map((step, i) => {
        const { name, verified } = typeof step === 'string' ? { name: step, verified: false } : step;
        return (
          <span key={`${name}-${i}`} className="contents">
            {i > 0 && <em className={`not-italic font-normal ${tone.arrow}`} aria-hidden>→</em>}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${verified ? tone.verified : tone.plain}`}>
              {verified && <Check className="size-3" strokeWidth={2.4} aria-label="verified" />}
              {name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export const TRUST_LEVELS = ['Self', 'Pending', 'Certified', 'Verified', '★ Made'];
const LEVEL_NAMES = ['Self-reported', 'Pending', 'Certified', 'Verified', '★ Made on UNIO'];

/** Five-segment ladder filled up to `level` (1–5). `dark` for navy cards (v9 .ladder / .ladder-dk). */
export function TrustLadder({ level = 1, dark = false, showLabels = true, className = '' }) {
  return (
    <div className={className} role="img" aria-label={`Trust level ${level} of 5: ${LEVEL_NAMES[level - 1]}`}>
      <div className="grid grid-cols-5 gap-[3px]">
        {TRUST_LEVELS.map((label, i) => {
          const on = i < level;
          const top = on && i === 4;
          let bg = dark ? 'bg-mist/25' : 'bg-line';
          if (on) bg = dark ? 'bg-bone' : 'bg-slate';
          if (top) bg = dark ? 'bg-[linear-gradient(90deg,var(--color-gold-lt),var(--color-bone))]' : 'bg-[linear-gradient(90deg,var(--color-ink),var(--color-slate))]';
          return <i key={label} className={`h-1.5 rounded-[3px] ${bg}`} />;
        })}
      </div>
      {showLabels && (
        <div className={`mt-1 grid grid-cols-5 gap-[3px] font-mono text-[10px] tracking-[0.04em] ${dark ? 'text-mist' : 'text-steel'}`} aria-hidden>
          {TRUST_LEVELS.map((label) => (
            <span key={label} className="truncate">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const LEVEL_TAG = {
  1: 'border-line2 bg-white text-steel',
  2: 'border-wait-ln bg-wait-bg text-wait',
  3: 'border-navy bg-white text-navy',
  4: 'border-navy bg-navy text-white',
  5: 'border-ink bg-[linear-gradient(120deg,var(--color-ink),var(--color-slate))] text-gold-lt',
};

/** Small mono tag for a trust level (v9 .lvl.lvN). */
export function TrustLevelTag({ level = 1, className = '' }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.06em] ${LEVEL_TAG[level] ?? LEVEL_TAG[1]} ${className}`}
    >
      {LEVEL_NAMES[level - 1] ?? LEVEL_NAMES[0]}
    </span>
  );
}
