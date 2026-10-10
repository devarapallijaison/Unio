import { Play } from 'lucide-react';
import { useState } from 'react';
import { hashString } from '../../lib/format.js';

/** Seeded demo media lives on the reserved `.example` domain; treat it as "not yet supplied". */
export function isPlaceholderUrl(url) {
  if (!url) return true;
  try {
    return new URL(url).hostname.endsWith('.example');
  } catch {
    return true;
  }
}

const C = {
  forest: '#47553A',
  sage: '#C7D2C2',
  mint: '#E6EEE4',
  sand: '#EADFCF',
  beige: '#D4C7A1',
  ivory: '#FAF9F5',
};

/* Six restrained compositions built only from the brand palette. */
const COMPOSITIONS = [
  (r) => (
    <>
      <rect width="400" height="500" fill={C.sand} />
      <circle cx="400" cy="500" r={360 - r * 40} fill={C.beige} />
      <circle cx="400" cy="500" r={250 - r * 30} fill={C.sage} />
      <circle cx="400" cy="500" r={140 - r * 20} fill={C.forest} />
    </>
  ),
  (r) => (
    <>
      <rect width="400" height="500" fill={C.mint} />
      <rect y={300 + r * 30} width="400" height="250" fill={C.sage} />
      <circle cx={120 + r * 140} cy={250 + r * 20} r="70" fill={C.forest} />
      <line x1="0" x2="400" y1={300 + r * 30} y2={300 + r * 30} stroke={C.ivory} strokeWidth="2" />
    </>
  ),
  (r) => (
    <>
      <rect width="400" height="500" fill={C.sage} />
      <circle cx={160 - r * 20} cy="230" r="110" fill={C.mint} />
      <circle cx={250 + r * 20} cy="290" r="110" fill={C.ivory} fillOpacity="0.75" />
      <circle cx="140" cy="100" r="26" fill={C.forest} />
    </>
  ),
  (r) => (
    <>
      <rect width="400" height="500" fill={C.ivory} />
      {[0, 1, 2, 3].map((i) => {
        const h = 160 + ((i * 97 + r * 211) % 220);
        return <rect key={i} x={36 + i * 86} y={500 - h - 40} width="62" height={h} rx="31" fill={i === (r * 4 | 0) % 4 ? C.forest : C.sage} />;
      })}
    </>
  ),
  (r) => (
    <>
      <rect width="400" height="500" fill={C.forest} />
      <rect x="40" y="40" width="320" height="420" fill="none" stroke={C.sage} strokeOpacity="0.5" />
      <circle cx="200" cy={210 + r * 40} r="90" fill={C.sand} />
      <rect x="110" y={330 + r * 30} width="180" height="2" fill={C.beige} />
    </>
  ),
  (r) => (
    <>
      <rect width="400" height="500" fill={C.sand} />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={50 + (i % 3) * 110}
          y={60 + Math.floor(i / 3) * 100}
          width="80"
          height="80"
          rx={i % 2 ? 40 : 6}
          fill={i === Math.floor(r * 12) ? C.forest : C.ivory}
          fillOpacity={i === Math.floor(r * 12) ? 1 : 0.8}
        />
      ))}
    </>
  ),
];

function Placeholder({ seed, label, mediaType, showLabel }) {
  const h = hashString(seed);
  const variant = h % COMPOSITIONS.length;
  const r = ((h >>> 8) % 1000) / 1000;
  const dark = variant === 4;
  return (
    <div className="relative size-full" role="img" aria-label={`${label || 'Portfolio piece'} — media placeholder`}>
      <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        {COMPOSITIONS[variant](r)}
      </svg>
      {showLabel && (
        <span
          className={`absolute bottom-2.5 left-2.5 font-mono text-[9.5px] uppercase tracking-[0.14em] ${dark ? 'text-sage' : 'text-ink/55'}`}
        >
          {mediaType === 'video' ? 'Video' : 'Image'} · media pending
        </span>
      )}
    </div>
  );
}

/**
 * Frame for portfolio/campaign media. Shows the real thumbnail or image when available,
 * otherwise an honest, art-directed placeholder. Never renders a broken image.
 */
export function MediaFrame({ item, aspect = 'aspect-[4/5]', className = '', showLabel = true, hover = true }) {
  const [failed, setFailed] = useState(false);
  const src = item?.mediaType === 'video' ? item?.thumbnailUrl : item?.thumbnailUrl || item?.mediaUrl;
  const usable = src && !isPlaceholderUrl(src) && !failed;

  return (
    <div className={`group/media relative overflow-hidden rounded-md bg-sand ${aspect} ${className}`}>
      <div className={`absolute inset-0 ${hover ? 'transition-transform duration-700 ease-out group-hover/media:scale-[1.03]' : ''}`}>
        {usable ? (
          <img src={src} alt={item?.title ?? ''} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <Placeholder seed={item?._id ?? item?.title ?? 'unio'} label={item?.title} mediaType={item?.mediaType} showLabel={showLabel} />
        )}
      </div>
      {item?.mediaType === 'video' && (
        <span className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-ivory/90 text-forest">
          <Play className="size-3.5 translate-x-[1px] fill-current" />
        </span>
      )}
    </div>
  );
}
