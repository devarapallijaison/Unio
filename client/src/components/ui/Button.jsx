import { Loader2 } from 'lucide-react';
import { Link } from 'react-router';

const VARIANTS = {
  primary: 'bg-forest text-ivory hover:bg-forest-deep border border-forest hover:border-forest-deep',
  secondary: 'bg-transparent text-ink border border-ink/80 hover:bg-ink hover:text-ivory',
  subtle: 'bg-mint text-forest border border-sage hover:bg-sage/70',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-ink/5',
  light: 'bg-ivory text-forest border border-ivory hover:bg-mint',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger hover:text-ivory hover:border-danger',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
};

export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return [
    'inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium tracking-[-0.005em]',
    'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
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
