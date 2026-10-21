import { useQuery } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { ApplicationCard } from '../../components/applications/ApplicationCard.jsx';
import { StatusTabs } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useClientScope } from '../../lib/clientScope.js';
import { endpoints } from '../../services/api.js';

export default function BrandApplications() {
  useDocumentTitle('Applications');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const { clientId } = useClientScope();
  const query = useQuery({
    queryKey: ['mine', 'brand-applications', { status, page, client: clientId }],
    queryFn: () => endpoints.brand.applications({ status, page, limit: 10, clientId }),
  });

  return (
    <>
      <PageHeader eyebrow="Inbox" title="Applications" description="Proposals across all of your campaigns." />
      <StatusTabs statuses={['pending', 'accepted', 'rejected', 'withdrawn']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
      {query.isLoading ? (
        <Skeleton className="h-48" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={Inbox} title={status === 'pending' ? 'You’re all caught up' : 'Nothing here'}>
          {status === 'pending' ? 'No proposals are waiting for review.' : 'No applications with this status.'}
        </EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((a) => (
              <ApplicationCard key={a._id} application={a} showCampaign />
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
