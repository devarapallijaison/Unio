import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, LayoutGrid, Menu, Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { CreatorCard, CreatorCardSkeleton } from '../../components/creators/CreatorCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState } from '../../components/ui/Feedback.jsx';
import { CheckRow, ChipSelect } from '../../components/ui/Form.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { useDebouncedCallback, useUrlFilters } from '../../hooks/useUrlFilters.js';
import { formatINR, pluralize } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/* v9 P2 — Discover. Every filter lives in the URL (multi-values comma-separated); counts come from the API's facets. */

const LIST_KEYS = ['cat', 'types', 'spec', 'skills', 'tools', 'styles', 'formats', 'langs', 'trust'];
const KEYS = [...LIST_KEYS, 'q', 'vonly', 'maxPrice', 'maxDays', 'avail', 'sort', 'page'];

/** Facet sections: [url key, title, taxonomy list]. The first four are always shown; the rest sit under "More filters". */
const MAIN_FACETS = [
  ['types', 'Content type', 'contentTypes'],
  ['spec', 'Specialization', 'specializations'],
  ['skills', 'Skills', 'skills'],
  ['tools', 'Tools', 'tools'],
];
const MORE_FACETS = [
  ['styles', 'Style', 'styles'],
  ['formats', 'Format', 'formats'],
  ['langs', 'Language', 'languages'],
  ['trust', 'Trust level', 'trust'],
];
const TRUST_OPTIONS = [
  { id: 'v', label: 'Has a verified tool' },
  { id: 'c', label: 'Has a certificate' },
  { id: 'm', label: '★ Made on UNIO' },
];
const BUDGETS = [
  [0, 'Any'],
  [5000, '≤ ₹5K'],
  [10000, '≤ ₹10K'],
  [20000, '≤ ₹20K'],
];
const TURNAROUND = [
  [0, 'Any'],
  [2, '≤ 2 days'],
  [5, '≤ 5 days'],
  [10, '≤ 10 days'],
];
const SORTS = [
  ['rating', 'Highest rated'],
  ['price', 'Price: low to high'],
  ['fast', 'Fastest turnaround'],
  ['mou', 'Most ★ Made on UNIO'],
  ['newest', 'Newest'],
];

const split = (v) => (v ? v.split(',').filter(Boolean) : []);

function FacetCount({ n }) {
  return n > 0 ? <span className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-navy px-[5px] text-[10px] font-bold tracking-normal text-white">{n}</span> : null;
}

function FacetSection({ title, options, selected, counts, onToggle, children }) {
  const [all, setAll] = useState(false);
  const shown = all ? options : options.filter((o, i) => i < 6 || selected.includes(o.id));
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-steel">
        {title}
        <FacetCount n={selected.length} />
      </legend>
      {children}
      {shown.map((o) => (
        <CheckRow key={o.id} label={o.label} count={counts?.[o.id] ?? 0} checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
      ))}
      {options.length > 6 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="self-start py-1 text-[12.5px] font-semibold text-navy underline underline-offset-[3px]">
          {all ? 'Show less' : `Show all ${options.length}`}
        </button>
      )}
    </fieldset>
  );
}

function ChipRow({ title, options, value, onChange }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-steel">{title}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, label]) => (
          <ChipSelect key={v} selected={(Number(value) || 0) === v} onClick={() => onChange(v || '')}>
            {label}
          </ChipSelect>
        ))}
      </div>
    </fieldset>
  );
}

function Facets({ taxonomy, values, facets, toggle, set, clear }) {
  const [more, setMore] = useState(false);
  const optionsFor = (list) => (list === 'trust' ? TRUST_OPTIONS : taxonomy[list]);
  const moreCount = MORE_FACETS.reduce((n, [k]) => n + split(values[k]).length, 0) + (values.maxDays ? 1 : 0);
  const section = ([key, title, list]) => (
    <FacetSection key={key} title={title} options={optionsFor(list)} selected={split(values[key])} counts={facets?.[key]} onToggle={(id) => toggle(key, id)}>
      {key === 'tools' && (
        <label className="mb-1 flex min-h-[30px] cursor-pointer items-center gap-2.5 rounded-md border border-ok-ln bg-ok-bg px-2.5 py-1 text-[13.5px] font-semibold text-ok">
          <input type="checkbox" className="size-[17px] accent-navy" checked={values.vonly === '1'} onChange={(e) => set({ vonly: e.target.checked ? '1' : '' })} />
          <span className="flex-1">Verified tools only</span>
          <Check className="size-3.5" strokeWidth={2.4} aria-hidden />
        </label>
      )}
    </FacetSection>
  );
  return (
    <>
      <div className="flex items-center justify-between">
        <b>Filters</b>
        <button type="button" onClick={clear} className="text-[12.5px] text-steel hover:text-ink">
          Clear all
        </button>
      </div>
      {MAIN_FACETS.map(section)}
      <ChipRow title="Budget per piece" options={BUDGETS} value={values.maxPrice} onChange={(v) => set({ maxPrice: v })} />
      <fieldset className="flex flex-col gap-0.5">
        <legend className="mb-1 font-mono text-[12px] uppercase tracking-[0.1em] text-steel">Availability</legend>
        <CheckRow label="Available now" checked={values.avail === '1'} onChange={(e) => set({ avail: e.target.checked ? '1' : '' })} />
      </fieldset>
      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
        className="flex flex-col items-start gap-0.5 rounded-md border-[1.5px] border-dashed border-line2 p-3 text-left text-[13.5px] font-bold text-navy"
      >
        <span>
          {more ? 'Fewer filters' : 'More filters'}
          <FacetCount n={moreCount} />
        </span>
        <span className="text-[12.5px] font-normal text-steel">Style · Format · Language · Trust · Turnaround</span>
      </button>
      {more && (
        <>
          <ChipRow title="Turnaround" options={TURNAROUND} value={values.maxDays} onChange={(v) => set({ maxDays: v })} />
          {MORE_FACETS.map(section)}
        </>
      )}
    </>
  );
}

function CategoryRail({ taxonomy, selected, facets, onSelect }) {
  const tile = 'flex w-[128px] shrink-0 flex-col items-start gap-1 rounded-lg border bg-white p-2.5 text-left transition-colors hover:border-steel';
  const on = 'border-navy bg-soft shadow-[inset_0_0_0_2px_var(--color-navy)]';
  return (
    <div className="-mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0" role="group" aria-label="Categories">
      <button type="button" aria-pressed={!selected} onClick={() => onSelect('')} className={`${tile} ${!selected ? on : 'border-line'}`}>
        <span className="grid h-16 w-full place-items-center rounded-[9px] bg-navy text-bone">
          <LayoutGrid className="size-5" />
        </span>
        <b className="mt-1 text-[13.5px] leading-tight">All creators</b>
        <span className="text-[11.5px] text-steel">{facets?.allCategories ?? '—'}</span>
      </button>
      {taxonomy.categories.map((c) => {
        const n = facets?.cat?.[c.id] ?? 0;
        const isOn = selected === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={isOn}
            title={c.description}
            onClick={() => onSelect(isOn ? '' : c.id)}
            className={`${tile} ${isOn ? on : 'border-line'} ${n || isOn ? '' : 'opacity-45'}`}
          >
            <span className="block h-16 w-full overflow-hidden rounded-[9px]">
              <MediaFrame item={{ _id: `cat-${c.id}` }} aspect="aspect-auto" className="h-16 rounded-none" showLabel={false} hover={false} />
            </span>
            <b className="mt-1 text-[13.5px] leading-tight">{c.label}</b>
            <span className="text-[11.5px] leading-snug text-steel">
              {n} · {c.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function CreatorsPage() {
  useDocumentTitle('Discover creators');
  const { data: taxonomy, error: taxonomyError } = useTaxonomy();
  const { values, set, clear } = useUrlFilters(KEYS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(values.q);
  const setQ = useCallback((v) => set({ q: v }), [set]);
  const debouncedQ = useDebouncedCallback(setQ);
  useEffect(() => setDraft(values.q), [values.q]);
  const page = Number(values.page) || 1;

  const query = useQuery({
    queryKey: ['pub', 'creators', 'discover', values],
    queryFn: () => endpoints.creators.list({ ...values, sort: values.sort || 'rating', page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const facets = data?.facets;

  const toggle = (key, id) => {
    const list = split(values[key]);
    set({ [key]: (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]).join(',') });
  };

  // Active-filter chips: [label, remove()]
  const chips = [];
  if (taxonomy) {
    if (values.cat) chips.push([`Category: ${labelOf(taxonomy, 'categories', values.cat)}`, () => set({ cat: '' })]);
    for (const [key, title, list] of [...MAIN_FACETS, ...MORE_FACETS]) {
      for (const id of split(values[key])) {
        const label = list === 'trust' ? TRUST_OPTIONS.find((o) => o.id === id)?.label : labelOf(taxonomy, list, id);
        chips.push([`${title}: ${label}${key === 'tools' && values.vonly === '1' ? ' ✓' : ''}`, () => toggle(key, id)]);
      }
    }
    if (values.vonly === '1' && !values.tools) chips.push(['Verified tools only', () => set({ vonly: '' })]);
    if (values.maxPrice) chips.push([`Budget ≤ ${formatINR(Number(values.maxPrice))}`, () => set({ maxPrice: '' })]);
    if (values.maxDays) chips.push([`≤ ${values.maxDays} days`, () => set({ maxDays: '' })]);
    if (values.avail === '1') chips.push(['Available now', () => set({ avail: '' })]);
    if (values.q) chips.push([`“${values.q}”`, () => set({ q: '' })]);
  }
  const activeCount = chips.length;

  if (taxonomyError) {
    return (
      <div className="container-page py-16">
        <ErrorState error={taxonomyError} />
      </div>
    );
  }

  return (
    <div className="container-page pb-14 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Discover</span>
          <h1 className="mt-2 text-[30px] md:text-[44px]">
            Find the right <em>kind</em> of AI creator.
          </h1>
        </div>
        <label className="flex h-[50px] min-w-0 flex-[0_1_460px] items-center gap-2.5 rounded-full border border-line2 bg-white pl-[18px] pr-3 text-steel max-md:basis-full focus-within:border-navy">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Search creators</span>
          <input
            type="search"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              debouncedQ(e.target.value.trim());
            }}
            placeholder="Search skills, tools, styles, names…"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-steel [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button type="button" onClick={() => set({ q: '' })} className="rounded-full p-1 hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {taxonomy ? (
        <CategoryRail taxonomy={taxonomy} selected={values.cat} facets={facets} onSelect={(cat) => set({ cat })} />
      ) : (
        <div className="mt-5 h-[136px] animate-pulse rounded-lg bg-line/60" />
      )}

      <div className="mt-5 grid items-start gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          aria-label="Filters"
          className={`${panelOpen ? 'flex' : 'hidden'} flex-col gap-[18px] rounded-lg border border-line bg-white p-[18px] lg:sticky lg:top-[84px] lg:flex`}
        >
          {taxonomy ? <Facets taxonomy={taxonomy} values={values} facets={facets} toggle={toggle} set={set} clear={clear} /> : <div className="h-96 animate-pulse rounded bg-line/60" />}
        </aside>

        <section className="flex min-w-0 flex-col gap-4" aria-live="polite" aria-busy={query.isFetching}>
          <Button variant="secondary" className="self-start lg:hidden" aria-expanded={panelOpen} onClick={() => setPanelOpen((o) => !o)}>
            <Menu className="size-4" /> Filters
            <FacetCount n={activeCount} />
          </Button>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                {chips.length ? (
                  <>
                    {chips.map(([label, remove]) => (
                      <ChipSelect key={label} selected onClick={remove} aria-label={`Remove filter ${label}`}>
                        {label} <X className="size-3" />
                      </ChipSelect>
                    ))}
                    <button type="button" onClick={clear} className="ml-1 text-[12.5px] text-steel hover:text-ink">
                      Clear all
                    </button>
                  </>
                ) : (
                  <span className="text-[12.5px] text-steel">No filters yet — pick a category or tick anything on the left.</span>
                )}
              </div>
              <label className="flex items-center gap-1.5 text-[12.5px] text-steel">
                Sort
                <select
                  value={values.sort || 'rating'}
                  onChange={(e) => set({ sort: e.target.value === 'rating' ? '' : e.target.value })}
                  className="h-9 rounded-md border border-[#9aa5aa] bg-white pl-2.5 pr-7 text-[13px] font-medium text-ink"
                >
                  {SORTS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[18px]">{data ? pluralize(data.total, 'creator') : 'Loading creators'}</b>
              <span className="text-[12.5px] text-steel">
                Within one filter = <b>any</b> of the ticks · across filters = <b>all</b> must match
              </span>
            </div>
          </div>

          {query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : query.isLoading ? (
            <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CreatorCardSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-white p-12 text-center">
              <Search className="size-5 text-steel" />
              <b>No creators match all of these.</b>
              <span className="text-[12.5px] text-steel">Try removing the last filter you added, or widen the budget.</span>
              <Button size="sm" variant="secondary" onClick={clear}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <>
              <div className={`grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3 ${query.isFetching ? 'opacity-70 transition-opacity' : ''}`}>
                {data.items.map((c) => (
                  <CreatorCard key={c._id} creator={c} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={(p) => {
                  set({ page: p }, { resetPage: false });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
