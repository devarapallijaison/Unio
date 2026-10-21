import { Check } from 'lucide-react';

const RING = {
  sm: { outer: 'size-[46px]', inner: 'size-9 text-[13px]' },
  md: { outer: 'size-14', inner: 'size-11 text-base' },
  lg: { outer: 'size-[84px]', inner: 'size-[68px] text-2xl' },
};

/** Conic match ring with the 0–100 score in the middle (v9 .ring). Scores come from the matching service. */
export function MatchRing({ score, size = 'md', dark = false, className = '' }) {
  const v = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const s = RING[size] ?? RING.md;
  return (
    <span
      role="img"
      aria-label={`Match score ${v} out of 100`}
      style={{ '--v': v, '--ring-fill': dark ? 'var(--color-bone)' : undefined, '--ring-track': dark ? 'var(--color-slate)' : undefined }}
      className={`match-ring grid shrink-0 place-items-center rounded-full ${s.outer} ${className}`}
    >
      <span className={`grid place-items-center rounded-full font-extrabold tracking-[-0.03em] ${s.inner} ${dark ? 'bg-navy text-white' : 'bg-white text-ink'}`}>
        {v}
      </span>
    </span>
  );
}

/**
 * Label · bar · value rows (v9 .bars). rows: [{ label, points, max, half? }].
 * `half` = counted at half weight (e.g. self-reported tools) and drawn in mist. `percent` shows 0–100% instead of points/max.
 */
export function ScoreBars({ rows = [], percent = false, className = '' }) {
  return (
    <div className={`flex flex-col gap-[7px] ${className}`}>
      {rows.map(({ label, points, max, half }) => {
        const pct = max ? Math.max(0, Math.min(100, (points / max) * 100)) : 0;
        return (
          <div key={label} className="grid grid-cols-[90px_1fr_34px] items-center gap-2.5 text-[12.5px] sm:grid-cols-[110px_1fr_40px]">
            <span className="truncate">{label}</span>
            <b className="relative block h-[7px] overflow-hidden rounded bg-line" aria-hidden>
              <i className={`absolute inset-y-0 left-0 rounded ${half ? 'bg-mist' : 'bg-navy'}`} style={{ width: `${pct}%` }} />
            </b>
            <span className="text-right tabular-nums">
              {percent ? (
                `${Math.round(pct)}%`
              ) : (
                <>
                  {points}
                  <span className="text-steel">/{max}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Plain-language reasons with green ticks (v9 .reasons). */
export function Reasons({ items = [], className = '' }) {
  if (!items.length) return null;
  return (
    <ul className={`flex flex-col gap-[5px] text-[12.5px] ${className}`}>
      {items.map((text) => (
        <li key={text} className="flex items-start gap-[7px]">
          <Check className="mt-0.5 size-3.5 shrink-0 text-ok" strokeWidth={2.2} aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  );
}
