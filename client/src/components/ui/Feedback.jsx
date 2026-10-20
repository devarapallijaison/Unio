import { AlertCircle, CheckCircle2, Info, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from './Button.jsx';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-line/70 ${className}`} aria-hidden />;
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-steel">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-navy/40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-navy" />
        </span>
        {label}…
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`flex flex-col items-start gap-3 rounded-lg border border-dashed border-line2 bg-white/60 px-6 py-10 sm:items-center sm:text-center ${className}`}>
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-soft text-navy ring-1 ring-line">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
      )}
      <h3 className="text-lg">{title}</h3>
      {children && <p className="max-w-md text-[14px] text-steel">{children}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this', className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-start gap-3 rounded-lg border border-att-ln bg-white px-6 py-8 ${className}`}>
      <div className="flex items-center gap-2 text-att">
        <AlertCircle className="size-5" strokeWidth={1.6} />
        <h3 className="text-base font-bold tracking-normal text-att">{title}</h3>
      </div>
      <p className="text-[14px] text-steel">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

/** Inline message boxes (v9 .okbox / .warn / .note-ai, plus error). */
const ALERT_TONES = {
  error: { cls: 'border-att-ln bg-att-bg text-att', Icon: AlertCircle },
  success: { cls: 'border-ok-ln bg-ok-bg text-ok', Icon: CheckCircle2 },
  warning: { cls: 'border-wait-ln bg-wait-bg text-wait', Icon: TriangleAlert },
  info: { cls: 'border-line2 bg-soft text-navy', Icon: Info },
  ai: { cls: 'border-ai-ln bg-ai-bg text-[#24346e]', Icon: Info },
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  const { cls, Icon } = ALERT_TONES[tone] ?? ALERT_TONES.info;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-md border px-3.5 py-3 text-[13px] ${cls} ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
      <div className="space-y-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
