import { useQuery } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { ApprovalLinkDialog, useApprovalLink } from '../../components/agency/ApprovalLinkDialog.jsx';
import { ClientBadge } from '../../components/agency/ClientBadge.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Pill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useClientScope } from '../../lib/clientScope.js';
import { formatDate, timeAgo } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/* Client approvals: every approval link on the agency's projects, grouped by what you should do next. */

const SECTIONS = [
  ['answered', 'Needs your decision', 'The client has answered. Their answer is advice: you approve or send changes.'],
  ['awaiting', 'Waiting on the client', 'Sent and not answered yet.'],
  ['expired', 'Expired', 'Links last 7 days and work once. Make a new one if the client still needs to decide.'],
  ['closed', 'Done', 'You have already decided on these versions.'],
];

function Row({ item, clients }) {
  const { create, created, clear } = useApprovalLink(item.projectId);
  const client = clients.find((c) => c._id === item.clientId) ?? { name: item.clientName };
  const who = item.approverName ?? 'No approver named';
  let line;
  if (item.status === 'answered') line = `${who} ${item.decision === 'approved' ? 'approved' : 'asked for changes'} ${timeAgo(item.usedAt)}`;
  else if (item.status === 'awaiting') line = `${who} · Sent ${timeAgo(item.createdAt)} · ${item.openedAt ? `opened ${timeAgo(item.openedAt)}` : 'not opened'} · until ${formatDate(item.expiresAt, { day: 'numeric', month: 'short' })}`;
  else if (item.status === 'expired') line = `${who} · expired ${formatDate(item.expiresAt, { day: 'numeric', month: 'short' })}`;
  else line = `${who} · ${item.usedAt ? `answered ${timeAgo(item.usedAt)}` : 'you decided first'}`;
  return (
    <li className="border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-3">
        <ClientBadge client={client} size="md" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[15px]">
            {item.projectTitle} · {item.deliverableTitle} · v{item.versionNumber}
          </b>
          <span className="block text-[13px] text-steel">
            {item.clientName} · {line}
          </span>
        </div>
        {item.status === 'answered' && <Pill tone={item.decision === 'approved' ? 'ok' : 'att'}>{item.decision === 'approved' ? 'Client approved' : 'Changes asked'}</Pill>}
        {item.status === 'awaiting' && <Pill tone="wait">Awaiting</Pill>}
        <div className="flex gap-1.5">
          {(item.status === 'awaiting' || item.status === 'expired') && (
            <Button size="sm" variant="ghost" onClick={() => create.mutate(item.deliverableId)} loading={create.isPending}>
              New link
            </Button>
          )}
          <ButtonLink to={`/projects/${item.projectId}`} size="sm" variant={item.status === 'answered' ? 'primary' : 'secondary'}>
            {item.status === 'answered' ? 'Decide' : 'Open'}
          </ButtonLink>
        </div>
      </div>
      {item.status === 'answered' && item.note && <p className="mt-2.5 rounded-md border border-line bg-soft px-3.5 py-2.5 text-[14px]">“{item.note}”</p>}
      {create.error && <p className="mt-2 text-[13px] text-att">{create.error.message}</p>}
      <ApprovalLinkDialog link={created} onClose={clear} />
    </li>
  );
}

export default function AgencyApprovals() {
  useDocumentTitle('Client approvals');
  const { clientId } = useClientScope();
  const clientsQ = useQuery({ queryKey: ['mine', 'clients'], queryFn: endpoints.brand.clients });
  const clients = clientsQ.data ?? [];
  const scope = clients.some((c) => c._id === clientId) ? clientId : '';
  const query = useQuery({ queryKey: ['mine', 'approvals', scope], queryFn: () => endpoints.brand.approvals({ clientId: scope }) });
  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Client approvals" description="Share one link per version. Your client approves or asks for changes without logging in." />
      <div className="mt-6 space-y-5">
        {query.isLoading ? (
          <Skeleton className="h-48" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : items.length === 0 ? (
          <EmptyState icon={Timer} title="No approval links yet" action={<ButtonLink to="/brand/projects">Open projects</ButtonLink>}>
            When a creator submits a version, open its project and choose “Send to client” to make a link.
          </EmptyState>
        ) : (
          SECTIONS.map(([status, title, hint]) => {
            const rows = items.filter((i) => i.status === status);
            if (!rows.length) return null;
            return (
              <Card key={status}>
                <SectionHead title={`${title} · ${rows.length}`} action={<span className="hidden text-[13px] text-steel sm:block">{hint}</span>} />
                <ul>
                  {rows.map((i) => (
                    <Row key={i._id} item={i} clients={clients} />
                  ))}
                </ul>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
