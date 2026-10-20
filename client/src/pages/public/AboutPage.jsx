import { ButtonLink } from '../../components/ui/Button.jsx';
import { LogoMark } from '../../components/ui/Logo.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const PRINCIPLES = [
  ['Work before words', 'Creator profiles lead with portfolio pieces and the tools behind them, so brands judge the craft first.'],
  ['Open to browse', 'Anyone can explore creators and live briefs. You only need an account to apply, invite or manage work.'],
  ['Nothing sent by surprise', 'Applications and invitations are always reviewed and confirmed before they reach the other side.'],
  ['Explainable matching', 'Suggested creators come with plain-language reasons — skills, tools, budget fit — never a black-box score.'],
];

export default function AboutPage() {
  useDocumentTitle('About');
  return (
    <div className="pb-24">
      <section className="container-page grid gap-10 pb-16 pt-14 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-8">
          <p className="eyebrow">About UNIO</p>
          <h1 className="mt-5 text-[clamp(2.5rem,5.5vw,4.25rem)] tracking-[-0.045em]">
            A marketplace built around the <em>brief</em>.
          </h1>
        </div>
        <div className="flex items-end lg:col-span-4">
          <LogoMark className="h-24 lg:ml-auto" />
        </div>
      </section>

      <section className="container-page grid gap-10 border-t border-line/80 pt-14 lg:grid-cols-12">
        <p className="eyebrow lg:col-span-3">Why it exists</p>
        <div className="space-y-6 text-[17px] leading-relaxed lg:col-span-7">
          <p>
            AI tools have changed how product films, campaign imagery and motion are made. What hasn’t caught up is how brands find the people
            who use those tools well, and how both sides agree on the work.
          </p>
          <p className="text-steel">
            UNIO puts portfolios, briefs, proposals and deliverables in one flow. Brands publish a brief or invite a creator; creators apply with
            a proposal; an accepted match becomes a single project with tracked deliverables.
          </p>
        </div>
      </section>

      <section className="container-page mt-20">
        <div className="grid gap-px overflow-hidden rounded-lg border border-line/80 bg-line2/80 sm:grid-cols-2">
          {PRINCIPLES.map(([title, body], i) => (
            <div key={title} className="bg-page p-8">
              <p className="font-mono text-xs text-steel">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-3 text-2xl">{title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-steel">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="demo-content" className="container-page mt-20 grid gap-10 border-t border-line/80 pt-14 lg:grid-cols-12">
        <p className="eyebrow lg:col-span-3">About demo content</p>
        <div className="space-y-4 text-[15px] leading-relaxed text-steel lg:col-span-7">
          <p>
            This is a hackathon build. Profiles and brands marked <span className="font-mono text-xs uppercase tracking-wider text-ink">Demo</span>{' '}
            are fictional and exist to show how the marketplace works. Their portfolio pieces are placeholders, not real client work.
          </p>
          <p>Team member profiles are drafts; their skills and samples will be updated by each person.</p>
          <div className="flex flex-wrap gap-2 pt-4">
            <ButtonLink to="/creators">Explore creators</ButtonLink>
            <ButtonLink to="/campaigns" variant="secondary">
              Browse campaigns
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
