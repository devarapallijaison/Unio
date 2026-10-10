import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { CampaignRow, CampaignRowSkeleton } from '../../components/campaigns/CampaignRow.jsx';
import { DemoBadge } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

function useFeaturedWork() {
  const creators = useQuery({
    queryKey: ['pub', 'creators', { sort: 'featured', limit: 6 }],
    queryFn: () => endpoints.creators.list({ sort: 'featured', limit: 6 }),
  });
  const work = (creators.data?.items ?? []).flatMap((c) =>
    (c.portfolioPreview ?? []).slice(0, 1).map((p) => ({ ...p, creator: c })),
  );
  return { ...creators, work };
}

function Hero({ work, isLoading }) {
  const [a, b, c] = work;
  return (
    <section className="container-page grid gap-12 pb-16 pt-12 md:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-20">
      <div className="lg:col-span-7 animate-rise">
        <p className="eyebrow">AI Creator Marketplace</p>
        <h1 className="mt-6 text-[clamp(2.75rem,7.2vw,6.25rem)] font-[350] leading-[0.95] tracking-[-0.03em]">
          Where creators <em className="pr-[0.08em] font-[300] italic text-forest">and</em> brands unite.
        </h1>
        <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-muted sm:text-lg">
          UNIO connects brands with creators who make with AI — product films, campaign imagery, avatars and motion.
          Browse real portfolios, post a brief, and run the work from proposal to final delivery.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/creators" size="lg">
            Find a creator <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink to="/campaigns" size="lg" variant="secondary">
            Browse open briefs
          </ButtonLink>
        </div>
        <dl className="mt-12 grid max-w-xl grid-cols-2 gap-6 border-t border-beige/80 pt-6">
          <div>
            <dt className="eyebrow">For brands</dt>
            <dd className="mt-2 text-[15px] leading-snug">Publish a brief, compare proposals, invite the creators you like.</dd>
          </div>
          <div>
            <dt className="eyebrow">For creators</dt>
            <dd className="mt-2 text-[15px] leading-snug">Show your process and tools, apply to briefs, track every deliverable.</dd>
          </div>
        </dl>
      </div>

      <div className="relative hidden min-h-[520px] lg:col-span-5 lg:block" aria-label="Selected portfolio pieces">
        {isLoading ? (
          <>
            <Skeleton className="absolute right-0 top-0 h-[400px] w-[72%]" />
            <Skeleton className="absolute bottom-0 left-0 h-[240px] w-[48%]" />
          </>
        ) : (
          <>
            {a && (
              <Link to={`/creators/${a.creator._id}`} className="group absolute right-0 top-0 w-[72%] animate-rise [animation-delay:120ms]">
                <MediaFrame item={a} aspect="aspect-[4/5]" showLabel={false} />
                <span className="absolute left-3 top-3 max-w-[80%] truncate rounded-sm bg-ivory/95 px-2.5 py-1 text-[12px] text-ink">
                  {a.title} — <span className="text-muted group-hover:text-forest">{a.creator.displayName}</span>
                </span>
              </Link>
            )}
            {b && (
              <Link to={`/creators/${b.creator._id}`} className="absolute bottom-0 left-0 w-[46%] animate-rise [animation-delay:260ms]">
                <MediaFrame item={b} aspect="aspect-square" className="ring-8 ring-ivory" showLabel={false} />
                <p className="mt-2 text-[13px] text-muted">{b.creator.displayName}</p>
              </Link>
            )}
            {c && (
              <span className="absolute left-[6%] top-10 w-[18%] animate-rise [animation-delay:400ms]" aria-hidden>
                <MediaFrame item={c} aspect="aspect-[3/4]" showLabel={false} />
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ToolStrip() {
  const row = TOOLS.slice(0, 12);
  return (
    <section className="overflow-hidden border-y border-beige/80 bg-sand/50 py-4" aria-label="Tools our creators work with">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap motion-reduce:animate-none">
        {[...row, ...row].map((tool, i) => (
          <span key={`${tool}-${i}`} className="flex items-center gap-10 font-display text-xl italic text-forest/80 sm:text-2xl">
            {tool}
            <span className="size-1.5 rounded-full bg-beige" aria-hidden />
          </span>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ index, title, link }) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-xs text-muted">{index}</p>
        <h2 className="mt-2 text-4xl leading-tight sm:text-5xl">{title}</h2>
      </div>
      {link}
    </div>
  );
}

function SelectedWork({ work, isLoading, error, refetch }) {
  return (
    <section className="container-page py-20 lg:py-28">
      <SectionHead
        index="01 — Selected work"
        title={
          <>
            Portfolios first. <span className="text-muted">Pitches second.</span>
          </>
        }
        link={
          <Link to="/creators" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline">
            Explore all creators <ArrowUpRight className="size-4" />
          </Link>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-12 md:gap-6">
          {(isLoading ? Array.from({ length: 5 }) : work.slice(0, 5)).map((item, i) => {
            const layout = ['md:col-span-5 md:row-span-2', 'md:col-span-4', 'md:col-span-3', 'md:col-span-3', 'md:col-span-4'][i];
            const aspect = ['aspect-[4/5]', 'aspect-[4/3]', 'aspect-[3/4]', 'aspect-square', 'aspect-[16/10]'][i];
            if (!item) return <Skeleton key={i} className={`${layout} ${aspect}`} />;
            return (
              <Link key={item._id} to={`/creators/${item.creator._id}`} className={`group ${i === 0 ? 'col-span-2' : ''} ${layout}`}>
                <MediaFrame item={item} aspect={aspect} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium group-hover:text-forest">{item.title}</p>
                    <p className="text-[13px] text-muted">
                      {item.creator.displayName}
                      {item.tools?.length ? ` · ${item.tools.slice(0, 2).join(', ')}` : ''}
                    </p>
                  </div>
                  {item.creator.isDemo && <DemoBadge label="Demo" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

const STEPS = {
  brands: [
    ['Write the brief', 'Describe the outcome, deliverables, budget range and deadline. Save it as a draft until it’s ready.'],
    ['Choose your creator', 'Review proposals side by side, or invite creators whose portfolios fit. Match notes explain why someone fits.'],
    ['Approve the work', 'Every accepted creator gets one project with tracked deliverables. Approve or request a revision on each.'],
  ],
  creators: [
    ['Show how you work', 'List your skills, the AI tools you use and your starting price. Lead with portfolio pieces.'],
    ['Apply with a proposal', 'Pitch your approach and price on open briefs, or respond to invitations from brands.'],
    ['Deliver and get approved', 'Attach media to each deliverable and submit. Brands approve or ask for changes in one place.'],
  ],
};

function HowItWorks() {
  return (
    <section className="bg-sand/60">
      <div className="container-page py-20 lg:py-28">
        <SectionHead index="02 — How it works" title="One workflow, two sides of the table." />
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          {Object.entries(STEPS).map(([side, steps]) => (
            <div key={side}>
              <p className="eyebrow border-b border-beige pb-3">For {side}</p>
              <ol className="mt-2">
                {steps.map(([title, body], i) => (
                  <li key={title} className="grid grid-cols-[3rem_1fr] gap-2 border-b border-beige/70 py-6">
                    <span className="font-display text-3xl italic text-forest/70">{i + 1}</span>
                    <div>
                      <h3 className="font-sans text-lg font-semibold">{title}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <ButtonLink to={side === 'brands' ? '/register?role=brand' : '/register?role=creator'} variant="secondary" className="mt-8">
                {side === 'brands' ? 'Start as a brand' : 'Start as a creator'}
              </ButtonLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OpenBriefs() {
  const campaigns = useQuery({
    queryKey: ['pub', 'campaigns', { limit: 4 }],
    queryFn: () => endpoints.campaigns.list({ limit: 4 }),
  });
  const items = campaigns.data?.items ?? [];
  return (
    <section className="container-page py-20 lg:py-28">
      <SectionHead
        index="03 — Open briefs"
        title="Work that’s looking for a creator."
        link={
          <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline">
            See every open brief <ArrowUpRight className="size-4" />
          </Link>
        }
      />
      {campaigns.error ? (
        <ErrorState error={campaigns.error} onRetry={campaigns.refetch} />
      ) : campaigns.isLoading ? (
        <div>
          <CampaignRowSkeleton />
          <CampaignRowSkeleton />
        </div>
      ) : items.length ? (
        <div className="border-b border-beige/80">
          {items.map((c, i) => (
            <CampaignRow key={c._id} campaign={c} index={i + 1} />
          ))}
        </div>
      ) : (
        <p className="border-t border-beige/80 py-10 text-muted">No open briefs right now. New campaigns appear here as soon as brands publish them.</p>
      )}
    </section>
  );
}

function ClosingBand() {
  return (
    <section className="bg-forest text-ivory">
      <div className="container-page grid gap-10 py-20 md:grid-cols-12 md:items-end lg:py-24">
        <h2 className="text-[clamp(2.25rem,5vw,4rem)] leading-[1.02] text-ivory md:col-span-8">
          Your next collaboration starts with a <em className="italic text-sage">brief</em>.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row md:col-span-4 md:justify-end">
          <ButtonLink to="/register?role=brand" variant="light" size="lg">
            Post a brief
          </ButtonLink>
          <ButtonLink to="/register?role=creator" size="lg" className="!border-ivory/40 hover:!bg-ivory/10">
            Join as a creator
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  useDocumentTitle();
  const featured = useFeaturedWork();
  return (
    <>
      <Hero work={featured.work} isLoading={featured.isLoading} />
      <ToolStrip />
      <SelectedWork work={featured.work} isLoading={featured.isLoading} error={featured.error} refetch={featured.refetch} />
      <HowItWorks />
      <OpenBriefs />
      <ClosingBand />
    </>
  );
}
