import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Tag } from '../ui/Badge.jsx';
import { VerificationBadge } from '../verification/VerificationBadge.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { MediaFrame, isPlaceholderUrl } from '../ui/MediaFrame.jsx';

/** Varying aspect ratios give the grid an editorial rhythm instead of identical tiles. */
const RHYTHM = ['aspect-[4/5]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/3]', 'aspect-[4/5]', 'aspect-[5/6]'];

function PortfolioViewer({ item, onClose }) {
  const real = item && !isPlaceholderUrl(item.mediaUrl);
  return (
    <Dialog open={!!item} onClose={onClose} title={item?.title ?? ''} description={item?.category} size="lg">
      {item && (
        <div className="space-y-5">
          {real && item.mediaType === 'video' ? (
            <video src={item.mediaUrl} poster={isPlaceholderUrl(item.thumbnailUrl) ? undefined : item.thumbnailUrl} controls playsInline className="w-full rounded-md bg-ink" />
          ) : real ? (
            <img src={item.mediaUrl} alt={item.title} className="w-full rounded-md" />
          ) : (
            <MediaFrame item={item} aspect="aspect-[16/10]" hover={false} />
          )}
          {!real && (
            <p className="text-[13px] text-muted">
              The media for this piece hasn’t been uploaded yet, so a placeholder is shown.
            </p>
          )}
          {item.description && <p className="text-[15px] leading-relaxed">{item.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            {(item.tools ?? []).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {real && (
              <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1.5 text-sm text-forest hover:underline">
                Open original <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function PortfolioGrid({ items, statusById = {} }) {
  const [active, setActive] = useState(null);
  return (
    <>
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
        {items.map((item, i) => (
          <figure key={item._id} className="break-inside-avoid">
            <button type="button" onClick={() => setActive(item)} className="block w-full text-left" aria-label={`View ${item.title}`}>
              <MediaFrame item={item} aspect={RHYTHM[i % RHYTHM.length]} />
            </button>
            <figcaption className="mt-2.5 flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium leading-snug">{item.title}</span>
              {item.category && <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted">{item.category}</span>}
            </figcaption>
            {item.tools?.length > 0 && <p className="mt-0.5 text-[13px] text-muted">{item.tools.join(' · ')}</p>}
            {statusById[item._id] && statusById[item._id] !== 'SELF_REPORTED' && (
              <VerificationBadge status={statusById[item._id]} className="mt-1" />
            )}
          </figure>
        ))}
      </div>
      <PortfolioViewer item={active} onClose={() => setActive(null)} />
    </>
  );
}
