import { Check, HelpCircle, X } from 'lucide-react';

const ROW = {
  pass: { Icon: Check, cls: 'bg-ok-bg text-ok border-ok-ln', label: 'Passed' },
  fail: { Icon: X, cls: 'bg-att-bg text-att border-att-ln', label: 'Did not pass' },
  unknown: { Icon: HelpCircle, cls: 'bg-wait-bg text-wait border-wait-ln', label: 'Could not tell' },
};

/** "5/6 passed" for the pre-check pill. */
export const passSummary = (checks = []) => `${checks.filter((c) => c.result === 'pass').length}/${checks.length}`;

/**
 * Automatic pre-checks (v9 .ck). They are hints for the human reviewer and can be wrong,
 * so the heading and the caption never present them as a verdict.
 */
export function PreChecks({ checks = [], className = '' }) {
  return (
    <div className={className}>
      <p className="eyebrow">Automatic pre-checks</p>
      {checks.length ? (
        <ul className="mt-2.5 space-y-2">
          {checks.map((c, i) => {
            const { Icon, cls, label } = ROW[c.result] ?? ROW.unknown;
            return (
              <li key={`${c.id}-${i}`} className="flex items-start gap-2.5 text-[14px]">
                <span className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-full border ${cls}`}>
                  <Icon className="size-2.5" strokeWidth={3} aria-hidden />
                  <span className="sr-only">{label}</span>
                </span>
                <span>
                  {c.label}
                  {c.detail && <span className="block text-[12px] text-steel">{c.detail}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-steel">No automatic checks ran for this claim.</p>
      )}
      <p className="mt-2.5 text-[12px] text-steel">Hints only, and they can be wrong. A UNIO reviewer decides.</p>
    </div>
  );
}
