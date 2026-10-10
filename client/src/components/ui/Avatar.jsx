import { useState } from 'react';
import { hashString, initials } from '../../lib/format.js';

const PALETTES = [
  'bg-sage text-forest',
  'bg-sand text-forest',
  'bg-mint text-forest',
  'bg-beige text-ink',
  'bg-forest text-ivory',
];

const SIZES = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-lg', xl: 'size-28 text-3xl' };

export function Avatar({ name = '', src, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const palette = PALETTES[hashString(name) % PALETTES.length];
  const showImage = src && !failed && !/\.example\//.test(src);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-medium ${SIZES[size]} ${showImage ? 'bg-sand' : palette} ${className}`}
    >
      {showImage ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span aria-label={name}>{initials(name) || '·'}</span>
      )}
    </span>
  );
}
