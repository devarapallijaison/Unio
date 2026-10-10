import { useState } from 'react';
import { Link } from 'react-router';
import { statusLabel } from '../../lib/status.js';
import { Button } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { Alert } from '../ui/Feedback.jsx';

/** Real counts only — each tile links to the list it summarises. */
export function StatTile({ label, value, to, hint }) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-4xl leading-none">{value ?? '—'}</p>
      {hint && <p className="mt-2 text-[13px] text-muted">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-lg border border-beige/70 bg-white p-5 transition-colors hover:border-forest/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-beige/70 bg-white p-5">{body}</div>
  );
}

export function StatusTabs({ statuses, value, onChange }) {
  return (
    <div className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Filter by status">
      {['', ...statuses].map((s) => {
        const active = value === s;
        return (
          <button
            key={s || 'all'}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
              active ? 'bg-ink text-ivory' : 'text-ink/70 hover:bg-ink/5'
            }`}
          >
            {s ? statusLabel(s) : 'All'}
          </button>
        );
      })}
    </div>
  );
}

/** Confirmation step for consequential actions (accept, reject, withdraw, cancel...). */
export function ConfirmAction({ trigger, title, body, confirmLabel, variant = 'primary', onConfirm, error, pending }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <div className="space-y-5">
          {body && <div className="text-[15px] text-muted">{body}</div>}
          {error && <Alert tone="error">{error.message}</Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Go back
            </Button>
            <Button
              variant={variant}
              loading={pending}
              onClick={async () => {
                try {
                  await onConfirm();
                  setOpen(false);
                } catch {
                  // error surfaced via `error` prop
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function ListCard({ children, className = '' }) {
  return <li className={`rounded-lg border border-beige/70 bg-white p-5 ${className}`}>{children}</li>;
}
