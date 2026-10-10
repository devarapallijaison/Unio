import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { ConfirmAction, ListCard, StatusTabs } from '../../components/dashboard/Kit.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

function WithdrawButton({ application }) {
  const qc = useQueryClient();
  const toast = useToast();
  const withdraw = useMutation({
    mutationFn: () => endpoints.creator.withdraw(application._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub', 'campaign'] });
      toast.success('Application withdrawn.');
    },
  });
  return (
    <ConfirmAction
      title="Withdraw this application?"
      body="The brand will no longer see it as pending. You can’t apply to the same campaign again."
      confirmLabel="Withdraw"
      variant="danger"
      pending={withdraw.isPending}
      error={withdraw.error}
      onConfirm={() => withdraw.mutateAsync()}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open}>
          Withdraw
        </Button>
      )}
    />
  );
}

export default function CreatorApplications() {
  useDocumentTitle('Applications');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'applications', { status, page }],
    queryFn: () => endpoints.creator.applications({ status, page, limit: 10 }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Pitches"
        title="Applications"
        description="Every proposal you’ve sent and where it stands."
        actions={<ButtonLink to="/campaigns">Find more briefs</ButtonLink>}
      />
      <StatusTabs statuses={['pending', 'accepted', 'rejected', 'withdrawn']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Send} title={status ? 'Nothing here' : 'No applications yet'} action={<ButtonLink to="/campaigns">Browse open briefs</ButtonLink>}>
          Find a brief that suits your skills and send a proposal. You’ll review it before it’s submitted.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((a) => (
              <ListCard key={a._id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="eyebrow">{a.brand?.companyName ?? 'Brand'}</p>
                    <Link to={`/campaigns/${a.campaignId}`} className="mt-1 block font-display text-xl hover:text-forest">
                      {a.campaign?.title ?? 'Campaign'}
                    </Link>
                    <p className="mt-1 text-[13px] text-muted">
                      Submitted {formatDate(a.submittedAt)}
                      {a.proposedPrice != null && ` · Your price ${formatINR(a.proposedPrice)}`}
                      {a.campaign?.status === 'closed' && ' · Campaign closed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === 'pending' && <WithdrawButton application={a} />}
                    <StatusPill status={a.status} />
                  </div>
                </div>
                <details className="group mt-4 border-t border-beige/60 pt-3">
                  <summary className="cursor-pointer list-none text-[13px] text-forest hover:underline">Show proposal</summary>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{a.proposal}</p>
                </details>
                {a.status === 'accepted' && (
                  <ButtonLink to="/creator/projects" variant="subtle" size="sm" className="mt-4">
                    Go to project
                  </ButtonLink>
                )}
              </ListCard>
            ))}
          </ul>
          <div className="mt-8">
            <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </>
  );
}
