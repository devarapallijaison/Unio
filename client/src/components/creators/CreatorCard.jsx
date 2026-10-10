import { ArrowUpRight, BadgeCheck, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { formatINR } from '../../lib/format.js';
import { statusLabel } from '../../lib/status.js';
import { Avatar } from '../ui/Avatar.jsx';
import { DemoBadge, Tag } from '../ui/Badge.jsx';
import { MediaFrame } from '../ui/MediaFrame.jsx';

const AVAILABILITY_DOT = { available: 'bg-forest', busy: 'bg-beige', unavailable: 'bg-muted/40' };

export function AvailabilityLabel({ value }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span className={`size-1.5 rounded-full ${AVAILABILITY_DOT[value] ?? 'bg-muted/40'}`} aria-hidden />
      {statusLabel(value)}
    </span>
  );
}

/** Portfolio-led creator card. Layout varies with the number of previews so the grid doesn't feel stamped. */
export function CreatorCard({ creator }) {
  const previews = creator.portfolioPreview ?? [];
  return (
    <article className="group relative flex flex-col">
      <Link to={`/creators/${creator._id}`} className="absolute inset-0 z-10" aria-label={`View ${creator.displayName}’s profile`} />
      <div className="grid grid-cols-3 gap-1.5">
        {previews.length === 0 ? (
          <div className="col-span-3 flex aspect-[16/10] items-center justify-center rounded-md border border-dashed border-beige bg-white/60">
            <Avatar name={creator.displayName} src={creator.photoUrl} size="xl" />
          </div>
        ) : (
          <>
            <MediaFrame item={previews[0]} aspect="aspect-[4/5]" className={previews.length === 1 ? 'col-span-3 !aspect-[16/10]' : 'col-span-2 row-span-2'} showLabel={false} />
            {previews.length === 2 ? (
              <MediaFrame item={previews[1]} aspect="aspect-auto" className="row-span-2 h-full" showLabel={false} />
            ) : (
              previews.slice(1, 3).map((p) => <MediaFrame key={p._id} item={p} aspect="aspect-square" showLabel={false} />)
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3">
        <Avatar name={creator.displayName} src={creator.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl leading-tight">{creator.displayName}</h3>
            <ArrowUpRight className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {creator.location && (
              <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                <MapPin className="size-3.5" strokeWidth={1.75} /> {creator.location}
              </span>
            )}
            <AvailabilityLabel value={creator.availability} />
          </div>
        </div>
        {creator.startingPrice != null && (
          <div className="shrink-0 text-right">
            <p className="eyebrow">From</p>
            <p className="font-mono text-sm">{formatINR(creator.startingPrice)}</p>
          </div>
        )}
      </div>

      {(creator.verifiedCount > 0 || creator.completedProjects > 0) && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {creator.verifiedCount > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-forest" title="Claims confirmed by a UNIO reviewer">
              <BadgeCheck className="size-3.5" strokeWidth={2} /> {creator.verifiedCount} verified
            </span>
          )}
          {creator.completedProjects > 0 && (
            <span className="text-muted">
              {creator.completedProjects} completed on UNIO
            </span>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(creator.skills ?? []).slice(0, 3).map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
        {creator.isDemo && <DemoBadge className="ml-auto" label="Demo" />}
      </div>
    </article>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="col-span-2 row-span-2 aspect-[4/5] animate-pulse rounded-md bg-sand/60" />
        <div className="aspect-square animate-pulse rounded-md bg-sand/60" />
        <div className="aspect-square animate-pulse rounded-md bg-sand/60" />
      </div>
      <div className="mt-4 flex gap-3">
        <div className="size-11 animate-pulse rounded-full bg-sand/60" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded bg-sand/60" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-sand/60" />
        </div>
      </div>
    </div>
  );
}
