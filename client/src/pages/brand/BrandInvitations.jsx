import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmAction, StatusTabs } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

function CancelButton({ invitation }) {
  const qc = useQueryClient();
  const toast = useToast();
  const cancel = useMutation({
    mutationFn: () => endpoints.brand.cancelInvitation(invitation._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      toast.success('Invitation cancelled.');
    },
  });
  return (
    <ConfirmAction
      title="Cancel this invitation?"
      body={`${invitation.creator?.displayName ?? 'The creator'} will no longer be able to accept it. You can invite them again later.`}
      confirmLabel="Cancel invitation"
      variant="danger"
      pending={cancel.isPending}
      error={cancel.error}
      onConfirm={() => cancel.mutateAsync()}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open}>
          Cancel
        </Button>
      )}
    />
  );
}

export default function BrandInvitations() {
  useDocumentTitle('Invitations');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'brand-invitations', { status, page }],
    queryFn: () => endpoints.brand.invitations({ status, page, limit: 10 }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Outreach"
        title="Sent invitations"
        description="Creators you’ve invited and how they responded."
        actions={<ButtonLink to="/creators">Find creators</ButtonLink>}
      />
      <StatusTabs statuses={['pending', 'accepted', 'declined', 'cancelled']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Mail} title={status ? 'Nothing here' : 'No invitations sent'} action={<ButtonLink to="/creators">Browse creators</ButtonLink>}>
          Open a creator’s profile and choose “Invite to campaign”.
        </EmptyState>
      ) : (
        <>
          <ul className="overflow-hidden rounded-lg border border-beige/70 bg-white">
            {query.data.items.map((inv) => (
              <li key={inv._id} className="flex flex-col gap-3 border-b border-beige/60 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={inv.creator?.displayName ?? '?'} src={inv.creator?.photoUrl} size="md" />
                  <div className="min-w-0">
                    <Link to={`/creators/${inv.creatorId}`} className="font-medium hover:text-forest">
                      {inv.creator?.displayName}
                    </Link>
                    <p className="truncate text-[13px] text-muted">
                      {inv.campaign?.title} · {formatDate(inv.updatedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {inv.status === 'pending' && <CancelButton invitation={inv} />}
                  {inv.status === 'accepted' && (
                    <ButtonLink to="/brand/projects" variant="subtle" size="sm">
                      Project
                    </ButtonLink>
                  )}
                  <StatusPill status={inv.status} />
                </div>
              </li>
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
