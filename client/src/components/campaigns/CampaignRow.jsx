import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { formatBudget, relativeDeadline } from '../../lib/format.js';
import { DemoBadge, Tag } from '../ui/Badge.jsx';

/** Editorial index row for the campaign directory. */
export function CampaignRow({ campaign, index }) {
  const deliverableCount = (campaign.deliverables ?? []).reduce((n, d) => n + (d.quantity ?? 1), 0);
  return (
    <article className="group relative grid gap-4 border-t border-beige/80 py-7 transition-colors hover:bg-white/70 sm:px-3 md:grid-cols-12 md:gap-6">
      <Link to={`/campaigns/${campaign._id}`} className="absolute inset-0 z-10" aria-label={`Open brief: ${campaign.title}`} />
      <div className="flex items-baseline gap-3 md:col-span-1">
        {index != null && <span className="font-mono text-xs text-muted">{String(index).padStart(2, '0')}</span>}
      </div>
      <div className="md:col-span-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">
            {campaign.brand?.companyName ?? 'Brand'} · {campaign.category}
          </p>
          {campaign.brand?.isDemo && <DemoBadge label="Demo brand" />}
        </div>
        <h3 className="mt-2 font-display text-2xl leading-snug group-hover:text-forest sm:text-[28px]">{campaign.title}</h3>
        <p className="mt-2 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-muted">{campaign.brief}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...(campaign.requiredSkills ?? []), ...(campaign.requiredTools ?? [])].slice(0, 5).map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </div>
      </div>
      <div className="flex flex-row flex-wrap items-end justify-between gap-4 md:col-span-4 md:flex-col md:items-end md:justify-start md:text-right">
        <div>
          <p className="eyebrow">Budget</p>
          <p className="mt-1 font-mono text-[15px]">{formatBudget(campaign.budgetMin, campaign.budgetMax)}</p>
        </div>
        <div className="flex items-center gap-4 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" strokeWidth={1.75} /> {relativeDeadline(campaign.deadline)}
          </span>
          {deliverableCount > 0 && <span>{deliverableCount} deliverables</span>}
        </div>
        <span className="hidden items-center gap-1.5 text-sm font-medium text-forest md:inline-flex">
          Read brief <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

export function CampaignRowSkeleton() {
  return (
    <div className="grid gap-4 border-t border-beige/80 py-7 md:grid-cols-12" aria-hidden>
      <div className="space-y-3 md:col-span-7 md:col-start-2">
        <div className="h-3 w-40 animate-pulse rounded bg-sand/60" />
        <div className="h-7 w-3/4 animate-pulse rounded bg-sand/60" />
        <div className="h-4 w-full animate-pulse rounded bg-sand/60" />
      </div>
      <div className="h-10 animate-pulse rounded bg-sand/60 md:col-span-3 md:col-start-10" />
    </div>
  );
}
