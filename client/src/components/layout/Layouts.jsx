import {
  Briefcase,
  FolderKanban,
  Image,
  Inbox,
  LayoutGrid,
  Mail,
  Megaphone,
  PlusCircle,
  Send,
  UserRound,
} from 'lucide-react';
import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { SiteFooter } from './SiteFooter.jsx';
import { SiteHeader } from './SiteHeader.jsx';

function SkipLink() {
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-forest focus:px-3 focus:py-2 focus:text-ivory">
      Skip to content
    </a>
  );
}

export function RootLayout() {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main" className="min-h-[70vh]">
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </>
  );
}

const NAVS = {
  creator: [
    { to: '/creator/dashboard', label: 'Overview', icon: LayoutGrid },
    { to: '/creator/profile/edit', label: 'Profile', icon: UserRound },
    { to: '/creator/portfolio', label: 'Portfolio', icon: Image },
    { to: '/creator/applications', label: 'Applications', icon: Send },
    { to: '/creator/invitations', label: 'Invitations', icon: Mail },
    { to: '/creator/projects', label: 'Projects', icon: FolderKanban },
  ],
  brand: [
    { to: '/brand/dashboard', label: 'Overview', icon: LayoutGrid },
    { to: '/brand/campaigns', label: 'Campaigns', icon: Megaphone, end: true },
    { to: '/brand/campaigns/new', label: 'New campaign', icon: PlusCircle },
    { to: '/brand/applications', label: 'Applications', icon: Inbox },
    { to: '/brand/invitations', label: 'Invitations', icon: Mail },
    { to: '/brand/projects', label: 'Projects', icon: Briefcase },
    { to: '/brand/profile', label: 'Brand profile', icon: UserRound },
  ],
};

export function DashboardLayout({ role }) {
  const { user } = useAuth();
  const nav = NAVS[role];

  return (
    <div className="border-b border-beige/50 bg-mint/40">
      <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-6 py-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:py-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="hidden pb-5 lg:block">
            <p className="eyebrow">{role === 'brand' ? 'Brand workspace' : 'Creator studio'}</p>
            <p className="mt-1 truncate font-display text-lg">{user?.name}</p>
          </div>
          <nav aria-label="Dashboard" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-[14px] transition-colors ${
                    isActive ? 'bg-forest text-ivory' : 'text-ink/80 hover:bg-sage/50'
                  }`
                }
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** White content panel used across dashboards. */
export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-beige/70 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-beige/60 px-5 py-4">
          {title && <h2 className="font-sans text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
