/**
 * UNIO logo (design/logo, copied to client/public). The only multi-colour element in the UI.
 * `onDark` picks the white-text variant for dark heroes, the sidebar and the footer.
 */
export function Logo({ onDark = false, className = 'h-8' }) {
  const src = onDark ? '/unio-logo-on-dark.png' : '/unio-logo-on-light.png';
  return <img src={src} alt="UNIO" className={`w-auto ${className}`} width="395" height="120" />;
}

/** Icon-only mark (favicon / app icon). Decorative. */
export function LogoMark({ className = 'h-8' }) {
  return <img src="/unio-mark.png" alt="" aria-hidden className={`w-auto ${className}`} width="168" height="160" />;
}
