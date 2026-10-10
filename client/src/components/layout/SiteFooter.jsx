import { Link } from 'react-router';
import { LogoFull } from '../ui/Logo.jsx';

const COLUMNS = [
  {
    title: 'Brands',
    links: [
      { to: '/creators', label: 'Find creators' },
      { to: '/register', label: 'Post a brief' },
      { to: '/brand/dashboard', label: 'Brand dashboard' },
    ],
  },
  {
    title: 'Creators',
    links: [
      { to: '/campaigns', label: 'Browse campaigns' },
      { to: '/register', label: 'Create a profile' },
      { to: '/creator/dashboard', label: 'Creator dashboard' },
    ],
  },
  {
    title: 'UNIO',
    links: [
      { to: '/about', label: 'About' },
      { to: '/about#demo-content', label: 'About demo content' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-forest text-ivory">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-5">
          <LogoFull variant="light" className="h-16 sm:h-20" />
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-ivory/75">
            A marketplace for AI-native creative work. Brands find the right creator; creators find work worth making.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-sage">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="link-underline text-[15px] text-ivory/85 hover:text-ivory">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-ivory/15">
        <div className="container-page flex flex-col gap-2 py-6 text-[13px] text-ivory/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} UNIO. Built for a hackathon.</p>
          <p>Profiles marked “Demo” are fictional and show sample work only.</p>
        </div>
      </div>
    </footer>
  );
}
