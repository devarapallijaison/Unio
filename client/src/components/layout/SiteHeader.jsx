import { ChevronDown, LayoutGrid, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardFor } from '../../lib/returnTo.js';
import { Avatar } from '../ui/Avatar.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import { Logo } from '../ui/Logo.jsx';

const NAV = [
  { to: '/creators', label: 'Creators' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/about', label: 'About' },
];

function navClass({ isActive }) {
  return `relative py-1 text-[14px] transition-colors ${isActive ? 'text-ink after:absolute after:inset-x-0 after:-bottom-[21px] after:h-[2px] after:bg-forest' : 'text-muted hover:text-ink'}`;
}

function AccountMenu({ user, onLogout }) {
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
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-ink/5"
      >
        <Avatar name={user.name} size="sm" />
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-60 overflow-hidden rounded-md border border-beige/70 bg-ivory shadow-[0_18px_40px_-18px_rgba(32,37,29,0.35)] animate-rise">
          <div className="border-b border-beige/60 px-4 py-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="eyebrow mt-1.5">{user.role} account</p>
          </div>
          <Link role="menuitem" to={dashboardFor(user.role)} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-mint">
            <LayoutGrid className="size-4 text-muted" /> Dashboard
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm hover:bg-mint">
            <LogOut className="size-4 text-muted" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => {});
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-beige/60 bg-ivory/95 backdrop-blur-[2px]">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link to="/" className="shrink-0" aria-label="UNIO home">
          <Logo className="h-7 sm:h-8" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isLoading ? (
            <span className="h-8 w-24 animate-pulse rounded-md bg-sand/60" aria-hidden />
          ) : user ? (
            <>
              <ButtonLink to={dashboardFor(user.role)} variant="ghost" size="sm">
                Dashboard
              </ButtonLink>
              <AccountMenu user={user} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Join UNIO
              </ButtonLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="-mr-2 rounded-md p-2 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-beige/60 bg-ivory md:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className="border-b border-beige/40 py-3 font-display text-2xl">
                {item.label}
              </NavLink>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {user ? (
                <>
                  <ButtonLink to={dashboardFor(user.role)} size="lg">
                    Go to dashboard
                  </ButtonLink>
                  <button type="button" onClick={handleLogout} className="py-2 text-sm text-muted">
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
