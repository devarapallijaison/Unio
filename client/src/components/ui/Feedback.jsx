import { AlertCircle, CheckCircle2, Info, RotateCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-sand/60 ${className}`} aria-hidden />;
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-forest/40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-forest" />
        </span>
        {label}…
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`flex flex-col items-start gap-3 rounded-lg border border-dashed border-beige bg-white/50 px-6 py-10 sm:items-center sm:text-center ${className}`}>
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-mint text-forest">
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      )}
      <h3 className="font-display text-xl">{title}</h3>
      {children && <p className="max-w-md text-[15px] text-muted">{children}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this', className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-start gap-3 rounded-lg border border-danger/25 bg-white px-6 py-8 ${className}`}>
      <div className="flex items-center gap-2 text-danger">
        <AlertCircle className="size-5" strokeWidth={1.5} />
        <h3 className="font-sans text-base font-semibold text-danger">{title}</h3>
      </div>
      <p className="text-[15px] text-muted">{error?.message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

const ALERT_TONES = {
  error: { cls: 'border-danger/30 bg-[#fbf3f1] text-danger', Icon: AlertCircle },
  success: { cls: 'border-sage bg-mint text-forest', Icon: CheckCircle2 },
  info: { cls: 'border-beige bg-sand/50 text-ink', Icon: Info },
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  const { cls, Icon } = ALERT_TONES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-md border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink/80">{children}</div>}
      </div>
    </div>
  );
}
