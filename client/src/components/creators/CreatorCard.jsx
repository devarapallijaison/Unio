import { Play, Star } from 'lucide-react';
import { Link } from 'react-router';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatINR } from '../../lib/format.js';
import { statusLabel } from '../../lib/status.js';
import { Avatar } from '../ui/Avatar.jsx';
import { DemoBadge } from '../ui/Badge.jsx';
import { MatchRing } from '../ui/Match.jsx';
import { MediaFrame } from '../ui/MediaFrame.jsx';
import { ToolChain, ToolChip, TrustLevelTag } from '../ui/Trust.jsx';

const DOT = { available: 'bg-ok', busy: 'bg-[#d99a00]', unavailable: 'bg-mist' };

export function AvailabilityDot({ value, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`size-[7px] rounded-full ${DOT[value] ?? 'bg-mist'}`} aria-hidden />
      {statusLabel(value)}
    </span>
  );
}

export const formatDuration = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : null);

/** Trust state of one tool, from the server-computed lists (never decided on the client). */
export function toolStateFor(creator, tool) {
  const has = (list) => (list ?? []).some((t) => t.toLowerCase() === tool.toLowerCase());
  if (has(creator.verifiedTools)) return 'verified';
  if (has(creator.certifiedTools)) return 'certified';
  if (has(creator.pendingTools)) return 'pending';
  return 'self';
}

/** Category label for a card: "AI Video Creators" → "AI Video Creator". */
export function categoryLabel(taxonomy, id) {
  return id ? labelOf(taxonomy, 'categories', id).replace(/s$/, '') : null;
}

/**
 * v9 creator card — 8 parts: (1) typed thumbnail + ★ on UNIO, (2) name, city, availability, (3) rating or
 * match ring, (4) headline skill, (5) tools with trust state, (6) workflow chain, (7) starting price,
 * (8) trust level. Ratings and ★ counts render only when real records exist.
 * `preview` disables the link (C2 live preview).
 */
export function CreatorCard({ creator, match, preview = false }) {
  const { data: taxonomy } = useTaxonomy();
  const piece = creator.portfolioPreview?.[0];
  const type = categoryLabel(taxonomy, creator.category);
  const steps = (creator.workflow ?? []).map((name) => ({ name, verified: toolStateFor(creator, name) === 'verified' }));
  const Root = preview ? 'div' : Link;

  return (
    <Root
      {...(preview ? {} : { to: `/creators/${creator._id}` })}
      className="flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div className="relative">
        <MediaFrame item={piece ?? { _id: creator._id }} aspect="aspect-[16/11]" className="rounded-none" showLabel={false} hover={false} />
        {type && <span className="absolute left-2.5 top-2.5 rounded-full bg-ink/80 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">{type}</span>}
        {creator.madeOnUnioCount > 0 && (
          <span className="absolute right-2.5 top-2.5 rounded-[5px] bg-[linear-gradient(120deg,var(--color-ink),var(--color-slate))] px-2 py-0.5 font-mono text-[10.5px] font-bold text-gold-lt">
            ★ {creator.madeOnUnioCount} on UNIO
          </span>
        )}
        {piece?.mediaType === 'video' && formatDuration(piece.durationSec) && (
          <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-ink/60 py-0.5 pl-1.5 pr-2 font-mono text-[11px] text-white">
            <Play className="size-2.5 fill-current" aria-hidden /> {formatDuration(piece.durationSec)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={creator.displayName} src={creator.photoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[15px] tracking-[-0.01em]">{creator.displayName}</b>
            <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-steel">
              {creator.location && <>{creator.location} ·</>}
              <AvailabilityDot value={creator.availability} />
            </span>
          </div>
          {match != null ? (
            <MatchRing score={match} size="sm" />
          ) : creator.ratingCount > 0 ? (
            <span className="shrink-0 text-[12.5px] tabular-nums">
              <b className="inline-flex items-center gap-0.5">
                <Star className="size-3 fill-current" aria-hidden />
                {creator.ratingAvg}
              </b>{' '}
              <span className="text-steel">({creator.ratingCount})</span>
            </span>
          ) : null}
        </div>

        {creator.headline && <p className="line-clamp-1 text-[13.5px] font-semibold text-slate">{creator.headline}</p>}

        {creator.tools?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {creator.tools.slice(0, 4).map((t) => (
              <ToolChip key={t} name={t} state={toolStateFor(creator, t)} />
            ))}
          </div>
        )}

        {steps.length > 0 && <ToolChain steps={steps} />}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#edf0ef] pt-2.5">
          <span className="text-[12.5px] text-steel">
            {creator.startingPrice != null ? (
              <>
                From <b className="tabular-nums text-ink">{formatINR(creator.startingPrice)}</b> / piece
              </>
            ) : (
              'Price on request'
            )}
          </span>
          <span className="flex items-center gap-1.5">
            {creator.isDemo && <DemoBadge label="Demo" />}
            <TrustLevelTag level={creator.trustLevel ?? 1} />
          </span>
        </div>
      </div>
    </Root>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white" aria-hidden>
      <div className="aspect-[16/11] animate-pulse bg-line/60" />
      <div className="space-y-2.5 p-3.5">
        <div className="flex gap-2.5">
          <div className="size-[30px] animate-pulse rounded-full bg-line/60" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-line/60" />
          </div>
        </div>
        <div className="h-3 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-6 w-full animate-pulse rounded bg-line/60" />
      </div>
    </div>
  );
}
