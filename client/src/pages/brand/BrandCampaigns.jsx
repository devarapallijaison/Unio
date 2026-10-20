import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { StatusTabs } from '../../components/dashboard/Kit.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatBudget, relativeDeadline } from '../../lib/format.js';
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
    onError: (err) => toast.error(err.message),
  });
  return (
    <Button variant={next === 'open' ? 'subtle' : 'ghost'} size="sm" onClick={() => mutate.mutate()} loading={mutate.isPending}>
      {next === 'open' ? (campaign.status === 'draft' ? 'Publish' : 'Reopen') : 'Close'}
    </Button>
  );
}

export default function BrandCampaigns() {
  useDocumentTitle('Your campaigns');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'brand-campaigns', { status, page }],
    queryFn: () => endpoints.brand.campaigns({ status, page, limit: 10 }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Briefs"
        title="Your campaigns"
        actions={
          <ButtonLink to="/brand/campaigns/new">
            <Plus className="size-4" /> New campaign
          </ButtonLink>
        }
      />
      <StatusTabs statuses={['open', 'draft', 'closed']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
      {query.isLoading ? (
        <Skeleton className="h-48" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Megaphone} title={status ? 'Nothing here' : 'No campaigns yet'} action={<ButtonLink to="/brand/campaigns/new">Create your first campaign</ButtonLink>}>
          Publish a brief to start receiving proposals, or keep it as a draft until it’s ready.
        </EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-white">
            {/* v9 .tbl on desktop; rows stack into cards below md. */}
            <table className="tbl">
              <thead className="hidden md:table-header-group">
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Applications</th>
                  <th>Deadline</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((c) => (
                  <tr key={c._id} className="flex flex-col gap-3 border-b border-[#edf0ef] px-4 py-4 last:border-0 md:table-row md:p-0 [&>td]:max-md:border-0 [&>td]:max-md:p-0">
                    <td>
                      <Link to={`/brand/campaigns/${c._id}/applicants`} className="font-bold hover:text-navy">
                        {c.title}
                      </Link>
                      <p className="text-[13px] text-steel">
                        {c.category} · {formatBudget(c.budgetMin, c.budgetMax)}
                      </p>
                    </td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td>
                      <span className="font-bold tabular-nums">{c.applicationCounts.total}</span>
                      {c.applicationCounts.pending > 0 && <span className="text-steel"> · {c.applicationCounts.pending} to review</span>}
                    </td>
                    <td className="text-steel">{relativeDeadline(c.deadline)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1 md:justify-end">
                        <ButtonLink to={`/brand/campaigns/${c._id}/applicants`} variant="secondary" size="sm">
                          Applicants
                        </ButtonLink>
                        <ButtonLink to={`/brand/campaigns/${c._id}/edit`} variant="ghost" size="sm">
                          Edit
                        </ButtonLink>
                        <CampaignStatusButton campaign={c} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-8">
            <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </>
  );
}
