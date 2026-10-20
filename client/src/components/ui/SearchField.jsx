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
      <Search className="pointer-events-none absolute left-[18px] top-1/2 size-[18px] -translate-y-1/2 text-steel" strokeWidth={1.8} />
      <input
        id="search-field"
        type="search"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          debounced(e.target.value);
        }}
        placeholder={placeholder}
        className="h-[50px] w-full rounded-full border border-line2 bg-white pl-12 pr-11 text-[14px] font-medium placeholder:font-normal placeholder:text-steel/80 focus:border-navy focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => {
            setDraft('');
            onChange('');
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-steel hover:text-ink"
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
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                active ? 'border-navy bg-navy text-white' : 'border-line2 bg-white text-slate hover:border-navy'
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
