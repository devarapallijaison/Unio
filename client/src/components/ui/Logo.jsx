/** Supplied UNIO logo assets (see client/public). Sized by height; never stretched. */
export function Logo({ variant = 'dark', className = 'h-8' }) {
  const src = variant === 'light' ? '/logo-compact-light.png' : '/logo-compact.png';
  return <img src={src} alt="UNIO" className={`w-auto ${className}`} width="372" height="120" />;
}

export function LogoFull({ variant = 'dark', className = 'h-24' }) {
  const src = variant === 'light' ? '/logo-light.png' : '/logo.png';
  return <img src={src} alt="UNIO — Where Creators and Brands Unite" className={`w-auto ${className}`} width="1108" height="366" />;
}

export function LogoMark({ variant = 'dark', className = 'h-8' }) {
  const src = variant === 'light' ? '/logo-mark-light.png' : '/logo-mark.png';
  return <img src={src} alt="" aria-hidden className={`w-auto ${className}`} width="315" height="366" />;
}
