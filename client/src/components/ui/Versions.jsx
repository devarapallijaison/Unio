import { MediaFrame } from './MediaFrame.jsx';

/**
 * Vertical v1 → v2 → v3 timeline (v9 .tl-v / .tv). The current version is highlighted amber.
 * versions: [{ number, note, meta }] in order; `current` = number to highlight.
 */
export function VersionTimeline({ versions = [], current, className = '' }) {
  return (
    <ol className={`relative flex flex-col ${className}`}>
      {versions.map((v, i) => {
        const isCur = v.number === current;
        return (
          <li key={v.number} className="relative flex gap-3 pb-3.5">
            {i < versions.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-[30px] border-l-2 border-line" />}
            <span
              className={`grid h-[30px] w-9 shrink-0 place-items-center rounded-[7px] font-mono text-[11px] font-bold ${
                isCur ? 'bg-wait text-white' : 'bg-line text-slate'
              }`}
            >
              v{v.number}
            </span>
            <div className="min-w-0">
              <b className={`block text-[13.5px] ${isCur ? 'font-bold' : 'font-semibold'}`}>{v.note}</b>
              {v.meta && <span className="text-[12.5px] text-steel">{v.meta}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Grid of version thumbnails (v9 .film). versions: [{ number, thumbnailUrl, mediaUrl, mediaType, note }]. */
export function Filmstrip({ versions = [], current, className = '' }) {
  return (
    <div className={`grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 ${className}`}>
      {versions.map((v) => {
        const isCur = v.number === current;
        return (
          <figure
            key={v.number}
            className={`flex flex-col overflow-hidden rounded-md border bg-white ${isCur ? 'border-navy shadow-[inset_0_0_0_2px_var(--color-navy)]' : 'border-line'}`}
          >
            <MediaFrame item={{ ...v, _id: `${v.number}`, title: `v${v.number}` }} aspect="aspect-[4/5]" className="rounded-none" showLabel={false} hover={false} />
            <figcaption className="flex flex-col gap-1 px-2.5 py-[9px] text-[12px]">
              <span className="font-mono font-bold">v{v.number}</span>
              {v.note && <span className="text-steel">{v.note}</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
