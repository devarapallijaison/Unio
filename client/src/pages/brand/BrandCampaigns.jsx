import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Megaphone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Pill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Segmented } from '../../components/ui/Form.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { BRIEF_FIELDS, aiFilledCount, filledCount } from '../../lib/brief.js';
import { formatBudget, relativeDeadline } from '../../lib/format.js';
import { categoryName, deliverablesSummary } from '../../lib/rights.js';
import { endpoints } from '../../services/api.js';

export function CampaignStatusButton({ campaign }) {
  const qc = useQueryClient();
  const toast = useToast();
  const next = campaign.status === 'open' ? 'closed' : 'open';
  const mutate = useMutation({
    mutationFn: () => endpoints.brand.setCampaignStatus(campaign._id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(next === 'open' ? 'Campaign is now open.' : 'Campaign closed. Existing applications are kept.');
    },
    onError: (err) => toast.error(err.code === 'RIGHTS_REQUIRED' ? 'Set usage, region, duration and exclusivity before opening this brief.' : err.message),
  });
  return (
    <Button variant={next === 'open' ? 'subtle' : 'ghost'} size="sm" onClick={() => mutate.mutate()} loading={mutate.isPending}>
      {next === 'open' ? (campaign.status === 'draft' ? 'Publish' : 'Reopen') : 'Close'}
    </Button>
  );
}

const TABS = [
  ['open', 'Live'],
  ['draft', 'Drafts'],
  ['closed', 'Closed'],
];

function CampaignCell({ c, taxonomy }) {
  let meta;
  if (c.status === 'draft') {
    const ai = aiFilledCount(c);
    meta = ai ? `Draft · AI filled ${ai} of ${BRIEF_FIELDS.length} fields` : `Draft · ${filledCount(c)} of ${BRIEF_FIELDS.length} fields filled`;
  } else {
    meta = [categoryName(taxonomy, c.category), c.status === 'open' ? relativeDeadline(c.deadline) : 'Closed'].filter(Boolean).join(' · ');
  }
  return (
    <>
      <Link to={c.status === 'draft' ? `/brand/campaigns/${c._id}/edit` : `/campaigns/${c._id}`} className="font-bold hover:text-navy">
        {c.title}
      </Link>
      <p className="text-[13px] text-steel">{meta}</p>
    </>
  );
}

export default function BrandCampaigns() {
  useDocumentTitle('Campaigns');
  const { data: taxonomy } = useTaxonomy();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'brand-campaigns', { status, page }],
    queryFn: () => endpoints.brand.campaigns({ status, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const counts = query.data?.statusCounts;
  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Each brief carries its formats, style and rights."
        actions={
          <Segmented
            label="Campaign status"
            value={status}
            onChange={(s) => {
              setStatus(s);
              setPage(1);
            }}
            options={TABS.map(([value, label]) => ({ value, label: counts ? `${label} · ${counts[value] ?? 0}` : label }))}
          />
        }
      />
      <div className="mt-6">
        {query.isLoading ? (
          <Skeleton className="h-48" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title={{ open: 'No live campaigns', draft: 'No drafts', closed: 'No closed campaigns' }[status]}
            action={
              <ButtonLink to="/brand/campaigns/new">
                <Sparkles className="size-4" /> New brief with AI
              </ButtonLink>
            }
          >
            Say what you need in one line and the brief builder drafts the rest — formats, style and rights included.
          </EmptyState>
        ) : (
          <>
            <div className={`overflow-hidden rounded-lg border border-line bg-white ${query.isFetching ? 'opacity-70' : ''}`}>
              {/* v9 .tbl on desktop; rows stack into cards below md. */}
              <table className="tbl">
                <thead className="hidden md:table-header-group">
                  <tr>
                    <th>Campaign</th>
                    <th>Deliverables</th>
                    <th>Rights</th>
                    <th>Budget</th>
                    <th>Applicants</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => {
                    const draft = c.status === 'draft';
                    return (
                      <tr key={c._id} className="flex flex-col gap-2.5 border-b border-[#edf0ef] px-4 py-4 last:border-0 md:table-row md:p-0 [&>td]:max-md:border-0 [&>td]:max-md:p-0">
                        <td>
                          <CampaignCell c={c} taxonomy={taxonomy} />
                        </td>
                        <td className="text-[14px]">{deliverablesSummary(c.deliverables) || '—'}</td>
                        <td>
                          {c.rightsSummary ? (
                            <span className="inline-flex max-w-[260px] items-center gap-1.5 rounded-[6px] border border-line2 px-2 py-1 text-[12.5px] text-slate">
                              <Lock className="size-3 shrink-0" strokeWidth={1.8} aria-hidden />
                              <span className="truncate" title={c.rightsSummary}>
                                {c.rightsSummary.split(' · ').slice(0, 2).join(' · ')}
                              </span>
                            </span>
                          ) : (
                            <Pill tone="wait">Rights missing</Pill>
                          )}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{draft ? '—' : formatBudget(c.budgetMin, c.budgetMax)}</td>
                        <td>
                          {draft ? (
                            '—'
                          ) : (
                            <>
                              <b className="tabular-nums">{c.applicationCounts.total}</b>
                              {c.applicationCounts.pending > 0 && <span className="text-[13px] text-steel"> · {c.applicationCounts.pending} to review</span>}
                            </>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap items-center gap-1 md:flex-nowrap md:justify-end">
                            {draft ? (
                              <ButtonLink to={`/brand/campaigns/${c._id}/edit`} size="sm">
                                Finish
                              </ButtonLink>
                            ) : (
                              <>
                                <ButtonLink to={`/brand/campaigns/${c._id}/applicants`} variant="secondary" size="sm">
                                  Applicants
                                </ButtonLink>
                                <ButtonLink to={`/brand/campaigns/${c._id}/edit`} variant="ghost" size="sm">
                                  Edit
                                </ButtonLink>
                                <CampaignStatusButton campaign={c} />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-8">
              <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
