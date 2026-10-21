import { Lock } from 'lucide-react';

/** One-line rights summary with a lock, dashed border (v9 .bc-r). Text comes from rightsSummary() on the server. */
export function RightsStrip({ summary, className = '' }) {
  if (!summary) return null;
  return (
    <div
      className={`flex items-center gap-[7px] rounded-[6px] border border-dashed border-line2 bg-[linear-gradient(90deg,#e6ebee,#f3f5f5)] px-2.5 py-1.5 text-[12.5px] font-semibold text-navy ${className}`}
    >
      <Lock className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
      <span>{summary}</span>
    </div>
  );
}

/**
 * Dark "ticket" with side notches, perforation and a stamp (v9 .ticket).
 * rows: [{ label, value }]. `notchBg` must match the surface behind the ticket.
 * Always a plain-language summary — never present it as a legal contract.
 */
export function RightsTicket({
  eyebrow = 'Rights & usage',
  title,
  number,
  stamp = 'RIGHTS',
  rows = [],
  note = 'A plain-language summary of what was agreed in the brief. Not a legal contract.',
  notchBg = 'var(--color-page)',
  className = '',
}) {
  return (
    <div
      style={{ '--notch-bg': notchBg }}
      className={`relative overflow-hidden rounded-lg bg-[linear-gradient(135deg,var(--color-ink),var(--color-navy)_60%,var(--color-slate))] px-6 py-[22px] text-[#e1e6e9] ${className}`}
    >
      <span
        aria-hidden
        className="absolute right-5 top-[18px] rotate-6 rounded-[6px] border-2 border-ok-ln px-2 py-[3px] font-mono text-[11px] font-bold tracking-[0.12em] text-ok-ln"
      >
        {stamp}
      </span>
      <div className="pr-24">
        <p className="eyebrow text-mist">{eyebrow}</p>
        {title && <h3 className="mt-1 text-lg text-white">{title}</h3>}
        {number && <p className="mt-1 font-mono text-[12px] text-bone">{number}</p>}
      </div>
      {/* Perforation with side notches cut at the divider (v9 .ticket). */}
      <div aria-hidden className="relative my-5 border-t border-dashed border-mist/35">
        <span className="absolute -left-[35px] top-0 size-[22px] -translate-y-1/2 rounded-full" style={{ background: 'var(--notch-bg)' }} />
        <span className="absolute -right-[35px] top-0 size-[22px] -translate-y-1/2 rounded-full" style={{ background: 'var(--notch-bg)' }} />
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-[130px_1fr]">
        {rows.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-mist">{label}</dt>
            <dd className="mb-1 font-semibold text-white sm:mb-0">{value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-5 text-[12px] text-mist">{note}</p>}
    </div>
  );
}
