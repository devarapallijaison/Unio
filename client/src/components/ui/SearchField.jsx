import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from '../../hooks/useUrlFilters.js';

export function SearchField({ value, onChange, placeholder, label = 'Search' }) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedCallback(onChange);

  useEffect(() => setDraft(value), [value]);

  return (
    <div className="relative w-full">
      <label className="sr-only" htmlFor="search-field">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted" strokeWidth={1.75} />
      <input
        id="search-field"
        type="search"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          debounced(e.target.value);
        }}
        placeholder={placeholder}
        className="h-12 w-full rounded-md border border-beige bg-white pl-11 pr-10 text-[15px] placeholder:text-muted/70 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('');
            onChange('');
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Pill-style single choice filter. */
export function ChipGroup({ label, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const v = typeof opt === 'string' ? opt : opt.value;
          const text = typeof opt === 'string' ? opt : opt.label;
          const active = value.toLowerCase() === v.toLowerCase();
          return (
            <button
              key={v || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active && v ? '' : v)}
              className={`rounded-sm border px-2.5 py-1 text-[13px] transition-colors ${
                active ? 'border-forest bg-forest text-ivory' : 'border-beige bg-white/70 text-ink/80 hover:border-forest/60'
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
