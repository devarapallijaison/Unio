import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Megaphone, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { CampaignRow, CampaignRowSkeleton } from '../../components/campaigns/CampaignRow.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/Feedback.jsx';
import { Input, Select } from '../../components/ui/Form.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ChipGroup, SearchField } from '../../components/ui/SearchField.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { pluralize } from '../../lib/format.js';
import { SKILLS, TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const KEYS = ['search', 'category', 'skill', 'tool', 'minBudget', 'maxBudget', 'sort', 'page'];

function Filters({ values, set, categories }) {
  return (
    <div className="space-y-8">
      <ChipGroup label="Skill needed" value={values.skill} onChange={(v) => set({ skill: v })} options={SKILLS.slice(0, 10)} />
      <ChipGroup label="AI tool" value={values.tool} onChange={(v) => set({ tool: v })} options={TOOLS.slice(0, 10)} />
      <fieldset>
        <legend className="eyebrow mb-3">Budget (₹)</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Minimum budget" type="number" min="0" placeholder="Min" defaultValue={values.minBudget} onBlur={(e) => set({ minBudget: e.target.value })} />
          <Input aria-label="Maximum budget" type="number" min="0" placeholder="Max" defaultValue={values.maxBudget} onBlur={(e) => set({ maxBudget: e.target.value })} />
        </div>
      </fieldset>
      {categories?.length > 0 && (
        <div className="lg:hidden">
          <ChipGroup label="Category" value={values.category} onChange={(v) => set({ category: v })} options={categories} />
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  useDocumentTitle('Campaigns');
  const { values, set, clear, activeCount } = useUrlFilters(KEYS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const page = Number(values.page) || 1;

  const categories = useQuery({ queryKey: ['pub', 'categories'], queryFn: endpoints.campaigns.categories, staleTime: 5 * 60_000 });
  const query = useQuery({
    queryKey: ['pub', 'campaigns', values],
    queryFn: () => endpoints.campaigns.list({ ...values, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <div className="container-page pb-24 pt-12 lg:pt-16">
      <header className="grid gap-8 pb-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow">Open briefs</p>
          <h1 className="mt-3 text-5xl leading-[1] sm:text-6xl">Campaigns</h1>
          <p className="mt-4 max-w-lg text-[17px] text-muted">
            Live briefs from brands looking for AI creators. Read the full brief and deliverables before you pitch.
          </p>
        </div>
        <div className="flex gap-2 lg:col-span-5">
          <SearchField value={values.search} onChange={(v) => set({ search: v })} placeholder="Search briefs, skills or tools" label="Search campaigns" />
          <Button variant="secondary" className="h-12 lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Open filters">
            <SlidersHorizontal className="size-4" />
            {activeCount > 0 && <span className="font-mono text-xs">{activeCount}</span>}
          </Button>
        </div>
      </header>

      {categories.data?.length > 0 && (
        <nav className="-mx-4 mb-2 hidden overflow-x-auto border-y border-beige/80 px-4 lg:block" aria-label="Categories">
          <ul className="flex gap-8 py-4">
            {['', ...categories.data].map((c) => {
              const active = (values.category || '') === c;
              return (
                <li key={c || 'all'}>
                  <button
                    type="button"
                    onClick={() => set({ category: c })}
                    aria-pressed={active}
                    className={`whitespace-nowrap text-[15px] transition-colors ${active ? 'font-medium text-forest' : 'text-muted hover:text-ink'}`}
                  >
                    {c || 'All categories'}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_240px] lg:gap-14">
        <section aria-live="polite" aria-busy={query.isFetching} className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{data ? pluralize(data.total, 'open brief') : 'Loading briefs'}</p>
            <Select aria-label="Sort campaigns" value={values.sort || 'newest'} onChange={(e) => set({ sort: e.target.value })} className="w-48">
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline soonest</option>
              <option value="budget_desc">Highest budget</option>
            </Select>
          </div>

          {query.error ? (
            <ErrorState error={query.error} onRetry={query.refetch} />
          ) : query.isLoading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <CampaignRowSkeleton key={i} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No open briefs match"
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              }
            >
              Try removing a filter or searching for a broader term. New briefs are published regularly.
            </EmptyState>
          ) : (
            <>
              <div className="border-b border-beige/80">
                {data.items.map((c, i) => (
                  <CampaignRow key={c._id} campaign={c} index={(data.page - 1) * data.limit + i + 1} />
                ))}
              </div>
              <div className="mt-10">
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
      </div>

      <Dialog open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter campaigns">
        <Filters key={JSON.stringify(values)} values={values} set={set} categories={categories.data} />
        <div className="mt-8 flex gap-2">
          <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
            Show {data ? pluralize(data.total, 'brief') : 'results'}
          </Button>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
