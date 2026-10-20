import { Loader2 } from 'lucide-react';
import { Link } from 'react-router';

/** Pill buttons (v9 .btn). `light` / `outline-light` are for dark surfaces. */
const VARIANTS = {
  primary: 'bg-navy text-white border-transparent hover:bg-ink',
  secondary: 'bg-transparent text-navy border-navy hover:bg-navy hover:text-white',
  subtle: 'bg-soft text-navy border-line2 hover:bg-bone/60',
  ghost: 'bg-transparent text-navy border-transparent hover:bg-navy/[0.06]',
  light: 'bg-bone text-ink border-transparent hover:bg-white',
  'outline-light': 'bg-transparent text-page border-bone/50 hover:bg-white/[0.08]',
  success: 'bg-ok text-white border-transparent hover:bg-ok/90',
  danger: 'bg-white text-att border-att-ln hover:bg-att-bg',
};

const SIZES = {
  sm: 'h-[34px] px-[13px] text-[13px] gap-1.5',
  md: 'h-[42px] px-[18px] text-sm gap-2',
  lg: 'h-[50px] px-[26px] text-[15px] gap-2',
};

export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return [
    'inline-flex items-center justify-center whitespace-nowrap rounded-full border font-semibold',
    'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size],
    className,
  ].join(' ');
}

export function Button({ variant, size, loading = false, disabled, className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant, size, className, children, ...props }) {
  return (
    <Link to={to} className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** Round icon button (v9 .ib), e.g. the top-bar bell. */
export function IconButton({ label, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-grid size-[38px] place-items-center rounded-full border border-line bg-white text-navy transition-colors hover:bg-soft ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
