import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Lock, Megaphone } from 'lucide-react';
import { BriefCard } from '../../components/campaigns/BriefCard.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { ChipSelect, Segmented } from '../../components/ui/Form.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useUrlFilters } from '../../hooks/useUrlFilters.js';
import { endpoints } from '../../services/api.js';

/* v9 P4 — open campaigns. Filters live in the URL. "Best match" sorting and match rings arrive with Phase 7 (F4). */

const KEYS = ['group', 'exclusive', 'minBudget', 'sort', 'page'];
const GROUPS = [
  ['video', 'AI video'],
  ['ugc', 'UGC'],
  ['images', 'AI images'],
  ['3d', '3D'],
  ['motion', 'Motion'],
];

export default function CampaignsPage() {
  useDocumentTitle('Open campaigns');
  const { values, set, clear } = useUrlFilters(KEYS);
  const page = Number(values.page) || 1;
  const groups = values.group ? values.group.split(',') : [];

  const query = useQuery({
    queryKey: ['pub', 'campaigns', values],
    queryFn: () => endpoints.campaigns.list({ ...values, sort: values.sort || 'newest', page, limit: 12 }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const toggleGroup = (g) => set({ group: (groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g]).join(',') });
  const filtered = groups.length || values.exclusive || values.minBudget;

  return (
    <div className="container-page pb-14 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Open campaigns</span>
          <h1 className="mt-2 text-[30px] md:text-[44px]">
            Briefs that say <em>exactly</em> what they need.
          </h1>
        </div>
        <Segmented
          label="Sort campaigns"
          value={values.sort || 'newest'}
          onChange={(v) => set({ sort: v === 'newest' ? '' : v })}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'deadline', label: 'Deadline' },
            { value: 'budget_desc', label: 'Budget' },
          ]}
        />
      </div>

      <div className="my-[22px] flex flex-wrap gap-2" role="group" aria-label="Filter campaigns">
        {GROUPS.map(([id, label]) => (
          <ChipSelect key={id} selected={groups.includes(id)} onClick={() => toggleGroup(id)}>
            {label}
          </ChipSelect>
        ))}
        <ChipSelect selected={values.exclusive === '1'} onClick={() => set({ exclusive: values.exclusive === '1' ? '' : '1' })}>
          <Lock className="size-3.5" /> Exclusive only
        </ChipSelect>
        <ChipSelect selected={values.minBudget === '10000'} onClick={() => set({ minBudget: values.minBudget === '10000' ? '' : '10000' })}>
          ₹10K+
        </ChipSelect>
      </div>

      {query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={filtered ? 'No briefs match these filters' : 'No open briefs right now'}
          action={
            filtered ? (
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            ) : null
          }
        >
          {filtered ? 'Try another content type or remove the budget filter.' : 'New campaigns appear here as soon as brands publish them.'}
        </EmptyState>
      ) : (
        <>
          <div className={`grid gap-4 md:grid-cols-2 ${query.isFetching ? 'opacity-70' : ''}`}>
            {data.items.map((c) => (
              <BriefCard key={c._id} campaign={c} />
            ))}
          </div>
          <div className="mt-8">
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
    </div>
  );
}
