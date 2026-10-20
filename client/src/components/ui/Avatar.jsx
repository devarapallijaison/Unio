import { useState } from 'react';
import { hashString, initials } from '../../lib/format.js';

/** Muted initials backgrounds from v9 (.c0–.c4); text is always navy. */
const PALETTES = ['bg-[#cfd9de]', 'bg-[#d8d2c4]', 'bg-[#d4dcd3]', 'bg-[#d7d3dd]', 'bg-[#dcd6cf]'];

const SIZES = { sm: 'size-[30px] text-[11px]', md: 'size-10 text-[13px]', lg: 'size-16 text-xl', xl: 'size-28 text-[34px] border-[5px] border-page' };

export function Avatar({ name = '', src, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const palette = PALETTES[hashString(name) % PALETTES.length];
  const showImage = src && !failed && !/\.example\//.test(src);
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold tracking-[-0.02em] text-navy ${SIZES[size]} ${showImage ? 'bg-line' : palette} ${className}`}
    >
      {showImage ? (
        <img src={src} alt={name} className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span aria-label={name}>{initials(name) || '·'}</span>
      )}
    </span>
  );
}
