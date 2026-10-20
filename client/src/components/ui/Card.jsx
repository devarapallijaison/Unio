/** White card, 1px line, radius 14 (v9 .card). `dark` = navy card. */
export function Card({ as: As = 'section', dark = false, pad = false, className = '', children, ...props }) {
  return (
    <As
      className={`rounded-lg border ${dark ? 'border-navy bg-navy text-[#e1e6e9]' : 'border-line bg-card'} ${pad ? 'p-[22px]' : ''} ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

/** Card section header row: title left, link/action right, bottom border (v9 .sec-h). */
export function SectionHead({ title, action, as: As = 'h2', className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-line px-5 py-4 ${className}`}>
      <As className="text-[17px] tracking-[-0.02em]">{title}</As>
      {action}
    </div>
  );
}

/** Dashboard "what needs you today" banner (v9 .banner). */
export function Banner({ eyebrow, title, children, action, className = '' }) {
  return (
    <div
      className={`relative flex flex-col items-start gap-6 overflow-hidden rounded-xl bg-[linear-gradient(120deg,var(--color-ink)_0%,var(--color-navy)_45%,var(--color-slate)_100%)] p-[22px] text-white sm:flex-row sm:items-center sm:px-[30px] sm:py-[26px] ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-[120px] size-80 rounded-full bg-[radial-gradient(closest-side,rgba(155,168,171,.25),transparent)]"
      />
      <div className="relative min-w-0 flex-1">
        {eyebrow && <p className="eyebrow text-mist">{eyebrow}</p>}
        <h2 className="mt-1 text-[26px] text-white sm:text-[30px]">{title}</h2>
        {children && <div className="mt-1.5 text-bone">{children}</div>}
      </div>
      {action && <div className="relative shrink-0">{action}</div>}
    </div>
  );
}
