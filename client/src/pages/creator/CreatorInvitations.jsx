import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { ConfirmAction, ListCard, StatusTabs } from '../../components/dashboard/Kit.jsx';
import { DemoBadge, StatusPill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatBudget, formatDate, relativeDeadline } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

export function InvitationResponseButtons({ invitation, size = 'md' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const respond = useMutation({
    mutationFn: (status) => endpoints.creator.respond(invitation._id, status),
    onSuccess: (data, status) => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      if (status === 'accepted' && data.project) {
        toast.success('Invitation accepted — your project is ready.');
        navigate(`/projects/${data.project._id}`);
      } else {
        toast.success('Invitation declined.');
      }
    },
  });

  if (invitation.status !== 'pending') return <StatusPill status={invitation.status} />;

  return (
    <div className="flex shrink-0 gap-2">
      <ConfirmAction
        title="Decline this invitation?"
        body={`${invitation.brand?.companyName ?? 'The brand'} will see that you declined. They can invite you again later.`}
        confirmLabel="Decline"
        variant="danger"
        pending={respond.isPending && respond.variables === 'declined'}
        error={respond.variables === 'declined' ? respond.error : null}
        onConfirm={() => respond.mutateAsync('declined')}
        trigger={(open) => (
          <Button variant="ghost" size={size} onClick={open}>
            Decline
          </Button>
        )}
      />
      <ConfirmAction
        title="Accept this invitation?"
        body={
          <>
            You’re agreeing to work on <span className="text-ink">{invitation.campaign?.title}</span>. A project with its deliverables will be
            created for you and the brand.
          </>
        }
        confirmLabel="Accept and start project"
        pending={respond.isPending && respond.variables === 'accepted'}
        error={respond.variables === 'accepted' ? respond.error : null}
        onConfirm={() => respond.mutateAsync('accepted')}
        trigger={(open) => (
          <Button size={size} onClick={open}>
            Accept
          </Button>
        )}
      />
    </div>
  );
}

export default function CreatorInvitations() {
  useDocumentTitle('Invitations');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'invitations', { status, page }],
    queryFn: () => endpoints.creator.invitations({ status, page, limit: 10 }),
  });

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Invitations" description="Brands that want to work with you. Accepting creates a project." />
      <StatusTabs statuses={['pending', 'accepted', 'declined', 'cancelled']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Mail} title={status ? 'Nothing here' : 'No invitations yet'}>
          A complete profile with strong portfolio pieces is the best way to get invited.
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((inv) => (
              <ListCard key={inv._id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="eyebrow">{inv.brand?.companyName}</p>
                      {inv.brand?.isDemo && <DemoBadge label="Demo brand" />}
                    </div>
                    <Link to={`/campaigns/${inv.campaignId}`} className="block font-extrabold tracking-[-0.03em] text-2xl leading-snug hover:text-navy">
                      {inv.campaign?.title ?? 'Campaign'}
                    </Link>
                    <p className="text-[13px] text-steel">
                      {formatBudget(inv.campaign?.budgetMin, inv.campaign?.budgetMax)} · {relativeDeadline(inv.campaign?.deadline)} · Invited{' '}
                      {formatDate(inv.createdAt)}
                    </p>
                    {inv.message && (
                      <blockquote className="mt-3 border-l-2 border-line2 pl-4 text-[14px] text-slate">“{inv.message}”</blockquote>
                    )}
                  </div>
                  <InvitationResponseButtons invitation={inv} />
                </div>
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
