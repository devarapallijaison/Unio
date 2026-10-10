import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, Users } from 'lucide-react';
import { useState } from 'react';
import { CreatorCard, CreatorCardSkeleton } from '../../components/creators/CreatorCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { Input, Select } from '../../components/ui/Form.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ChipGroup, SearchField } from '../../components/ui/SearchField.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { pluralize } from '../../lib/format.js';
import { CATEGORIES, SKILLS, TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const KEYS = ['search', 'skill', 'tool', 'specialty', 'availability', 'minPrice', 'maxPrice', 'sort', 'page'];

function Filters({ values, set }) {
  return (
    <div className="space-y-8">
      <ChipGroup
        label="Availability"
        value={values.availability}
        onChange={(v) => set({ availability: v })}
        options={[
          { value: '', label: 'Any' },
          { value: 'available', label: 'Available' },
          { value: 'busy', label: 'Limited' },
        ]}
      />
      <ChipGroup label="Skill" value={values.skill} onChange={(v) => set({ skill: v })} options={SKILLS.slice(0, 10)} />
      <ChipGroup label="AI tool" value={values.tool} onChange={(v) => set({ tool: v })} options={TOOLS.slice(0, 12)} />
      <ChipGroup label="Specialty" value={values.specialty} onChange={(v) => set({ specialty: v })} options={CATEGORIES.slice(0, 8)} />
      <fieldset>
        <legend className="eyebrow mb-3">Starting price (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Minimum price"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            defaultValue={values.minPrice}
            onBlur={(e) => set({ minPrice: e.target.value })}
          />
          <Input
            aria-label="Maximum price"
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            defaultValue={values.maxPrice}
            onBlur={(e) => set({ maxPrice: e.target.value })}
          />
        </div>
      </fieldset>
    </div>
  );
}

export default function CreatorsPage() {
  useDocumentTitle('Creators');
  const { values, set, clear, activeCount } = useUrlFilters(KEYS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const page = Number(values.page) || 1;

  const query = useQuery({
    queryKey: ['pub', 'creators', values],
    queryFn: () => endpoints.creators.list({ ...values, page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <div className="container-page pb-24 pt-12 lg:pt-16">
      <header className="grid gap-8 border-b border-beige/80 pb-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow">Explore</p>
          <h1 className="mt-3 text-5xl leading-[1] sm:text-6xl">Creators</h1>
          <p className="mt-4 max-w-lg text-[17px] text-muted">
            Filter by skill, tool and budget. Every profile leads with work, so you can judge the craft before you send a brief.
          </p>
        </div>
        <div className="flex gap-2 lg:col-span-5">
          <SearchField value={values.search} onChange={(v) => set({ search: v })} placeholder="Search name, skill, tool or city" label="Search creators" />
          <Button variant="secondary" className="h-12 lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Open filters">
            <SlidersHorizontal className="size-4" />
            {activeCount > 0 && <span className="font-mono text-xs">{activeCount}</span>}
          </Button>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-14">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24">
            <Filters key={JSON.stringify(values)} values={values} set={set} />
            {activeCount > 0 && (
              <button type="button" onClick={clear} className="mt-8 text-sm text-forest underline-offset-4 hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        <section aria-live="polite" aria-busy={query.isFetching}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {data ? pluralize(data.total, 'creator') : 'Loading creators'}
              {query.isFetching && data ? ' · updating…' : ''}
            </p>
            <Select aria-label="Sort creators" value={values.sort || 'featured'} onChange={(e) => set({ sort: e.target.value })} className="w-48">
              <option value="featured">Featured first</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </Select>
          </div>

          {query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : query.isLoading ? (
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CreatorCardSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No creators match these filters"
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              }
            >
              Try a broader skill, remove the price range, or search by tool instead.
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((c) => (
                  <CreatorCard key={c._id} creator={c} />
                ))}
              </div>
              <div className="mt-12">
                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(p) => {
                    set({ page: p }, { resetPage: false });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter creators">
        <Filters key={JSON.stringify(values)} values={values} set={set} />
        <div className="mt-8 flex gap-2">
          <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
            Show {data ? pluralize(data.total, 'creator') : 'results'}
          </Button>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
