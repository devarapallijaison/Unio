import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { initials as initialsOf } from '../../lib/format.js';

/** The fixed tag colours come from the server (GET /api/taxonomy → clientColors), so there is one source. */
export function useClientColor(colorId) {
  const { data } = useTaxonomy();
  const found = data?.clientColors?.find((c) => c.id === colorId) ?? data?.clientColors?.[0];
  return found ?? { bg: '#dfe3e2', fg: '#2a3a45' };
}

const SIZES = { sm: 'size-[26px] text-[10.5px] rounded-[7px]', md: 'size-9 text-[12px] rounded-[9px]', lg: 'size-12 text-[15px] rounded-[12px]' };

/** Client initials in the client's colour pair (v9 .clb). */
export function ClientBadge({ client, size = 'md', className = '' }) {
  const { bg, fg } = useClientColor(client?.color);
  const text = client?.initials || initialsOf(client?.name ?? client?.clientName ?? '') || '·';
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center font-extrabold tracking-[-0.02em] ${SIZES[size]} ${className}`}
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  );
}

/** Small "client tag" used in tables and cards when only the stored name is at hand. */
export function ClientTag({ name, color, className = '' }) {
  if (!name) return null;
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <ClientBadge client={{ name, color }} size="sm" />
      <span className="truncate text-[13.5px] font-semibold">{name}</span>
    </span>
  );
}
