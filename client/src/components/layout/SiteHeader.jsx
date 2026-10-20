import { ChevronDown, LayoutGrid, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useMatches, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardFor } from '../../lib/returnTo.js';
import { Avatar } from '../ui/Avatar.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { Logo } from '../ui/Logo.jsx';

const NAV = [
  { to: '/creators', label: 'Discover' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/about', label: 'How it works' },
];

function AccountMenu({ user, onLogout, dark }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2 ${dark ? 'hover:bg-white/10' : 'hover:bg-navy/[0.06]'}`}
      >
        <Avatar name={user.name} size="sm" />
        <ChevronDown className={`size-4 ${dark ? 'text-mist' : 'text-steel'}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-60 overflow-hidden rounded-lg border border-line bg-white text-ink shadow-pop animate-rise">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-steel">{user.email}</p>
            <p className="eyebrow mt-1.5">{user.role} account</p>
          </div>
          <Link role="menuitem" to={dashboardFor(user.role)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-soft">
            <LayoutGrid className="size-4 text-steel" /> Dashboard
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-soft">
            <LogOut className="size-4 text-steel" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Public header (v9 .hd): white 68px bar. Routes with `handle: { darkHeader: true }`
 * get the transparent variant with the light logo, for dark heroes.
 */
export function SiteHeader() {
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dark = useMatches().some((m) => m.handle?.darkHeader) && !mobileOpen;

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => {});
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `pb-1 text-[14px] font-semibold transition-colors ${
      dark
        ? isActive ? 'text-white shadow-[inset_0_-2px_0_#fff]' : 'text-mist hover:text-white'
        : isActive ? 'text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-steel hover:text-ink'
    }`;

  return (
    <header
      className={`z-40 border-b ${dark ? 'absolute inset-x-0 top-0 border-mist/20 bg-transparent' : 'sticky top-0 border-line bg-white'}`}
    >
      <div className="container-page flex h-[68px] items-center gap-7">
        <Link to="/" className="shrink-0" aria-label="UNIO home">
          <Logo onDark={dark} className="h-[30px]" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {isLoading ? (
            <span className="h-[34px] w-24 animate-pulse rounded-full bg-line/70" aria-hidden />
          ) : user ? (
            <>
              <ButtonLink to={dashboardFor(user.role)} variant={dark ? 'outline-light' : 'ghost'} size="sm">
                Dashboard
              </ButtonLink>
              <AccountMenu user={user} onLogout={handleLogout} dark={dark} />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant={dark ? 'outline-light' : 'ghost'} size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" variant={dark ? 'light' : 'primary'} size="sm">
                Join UNIO
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className={`-mr-2 ml-auto rounded-full p-2 md:hidden ${dark ? 'text-white' : 'text-ink'}`}
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-line bg-white md:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="border-b border-line py-3 text-[22px] font-extrabold tracking-[-0.03em]">
                {item.label}
              </NavLink>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {user ? (
                <>
                  <ButtonLink to={dashboardFor(user.role)} size="lg">
                    Go to dashboard
                  </ButtonLink>
                  <button type="button" onClick={handleLogout} className="py-2 text-sm text-steel">
                    Sign out ({user.email})
                  </button>
                </>
              ) : (
                <>
                  <ButtonLink to="/register" size="lg">
                    Join UNIO
                  </ButtonLink>
                  <ButtonLink to="/login" size="lg" variant="secondary">
                    Sign in
                  </ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
