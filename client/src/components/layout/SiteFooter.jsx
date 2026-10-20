import { Link } from 'react-router';
import { Logo } from '../ui/Logo.jsx';

/* Only links to pages that exist; Rights & licensing, UNIO Trust and Contact arrive in later phases. */
const COLUMNS = [
  {
    title: 'Brands',
    links: [
      { to: '/creators', label: 'Discover creators' },
      { to: '/register', label: 'Post a brief' },
    ],
  },
  {
    title: 'Creators',
    links: [
      { to: '/register', label: 'Join as creator' },
      { to: '/campaigns', label: 'Open campaigns' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/about#demo-content', label: 'About demo content' },
    ],
  },
];

/** Ink footer (v9 .ft). */
export function SiteFooter() {
  return (
    <footer className="bg-ink pb-7 pt-10 text-[13px] text-mist">
      <div className="container-page flex flex-wrap justify-between gap-8">
        <div className="max-w-[340px]">
          <Logo onDark className="h-[30px]" />
          <p className="mt-3 leading-relaxed">
            India’s marketplace for AI creators — with proof of how the work was made, and clear rights for how it can be used.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-bone transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="container-page mt-8">
        <div className="flex flex-col gap-2 border-t border-slate pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 UNIO · Made in India</p>
          <p className="font-mono text-[11px]">Profiles marked “Demo” are fictional and show sample work only.</p>
        </div>
      </div>
    </footer>
  );
}
