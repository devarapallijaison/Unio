import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApprovalLinkDialog, useApprovalLink } from '../../components/agency/ApprovalLinkDialog.jsx';
import { ClientBadge, ClientTag, useClientColor } from '../../components/agency/ClientBadge.jsx';
import { StatTile } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Pill, StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, timeAgo } from '../../lib/format.js';
import { useClientScope, withClient } from '../../lib/clientScope.js';
import { endpoints } from '../../services/api.js';
import { deliverableProgress } from '../shared/ProjectsList.jsx';

/* v9 A1 — agency overview. Same dashboard as a brand, plus the client strip, "Awaiting client" and a Client column. */

function ClientStripCard({ client, active, onPick }) {
  const { fg } = useClientColor(client.color);
  return (
    <button
      type="button"
      onClick={() => onPick(active ? '' : client._id)}
      aria-pressed={active}
      className={`flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3.5 text-left transition-shadow hover:shadow-card ${active ? 'border-navy ring-1 ring-navy' : 'border-line'}`}
      style={{ borderLeft: `4px solid ${fg}` }}
    >
      <ClientBadge client={client} size="md" />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] tracking-[-0.01em]">{client.name}</b>
        <span className="block text-[12.5px] text-steel">
          {client.campaigns} {client.campaigns === 1 ? 'campaign' : 'campaigns'} · {client.projects} {client.projects === 1 ? 'project' : 'projects'}
        </span>
      </span>
      {client.awaiting > 0 && (
        <span className="rounded-full border border-wait-ln bg-wait-bg px-2 py-0.5 text-[12px] font-bold text-wait" title={`${client.awaiting} approval link${client.awaiting > 1 ? 's' : ''} waiting`}>
          {client.awaiting}
        </span>
      )}
    </button>
  );
}

function WaitingRow({ item, clients }) {
  const { create, created, clear } = useApprovalLink(item.projectId);
  const client = clients.find((c) => c._id === item.clientId) ?? { name: item.clientName };
  const answered = item.status === 'answered';
  return (
    <li className="flex items-center gap-3 border-t border-line px-5 py-3.5 first:border-t-0">
      <ClientBadge client={client} size="md" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-[15px]">
          {item.projectTitle} · v{item.versionNumber}
        </b>
        <span className="block truncate text-[13px] text-steel">
          {answered
            ? `${item.approverName ?? 'Client'} ${item.decision === 'approved' ? 'approved it' : 'asked for changes'} · you confirm`
            : `${item.approverName ?? 'No approver named'} · Sent ${timeAgo(item.createdAt)} · ${item.openedAt ? 'opened' : 'not opened'}`}
        </span>
      </div>
      {answered ? (
        <ButtonLink to={`/projects/${item.projectId}`} size="sm" variant="secondary">
          Review
        </ButtonLink>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => create.mutate(item.deliverableId)} loading={create.isPending} title="Make a fresh link. The old one stops working.">
          New link
        </Button>
      )}
      <ApprovalLinkDialog link={created} onClose={clear} />
    </li>
  );
}

function ProjectRow({ p, clients }) {
  const client = clients.find((c) => c._id === p.clientId) ?? { name: p.clientName };
  const progress = deliverableProgress(p);
  const latest = (p.deliverables ?? []).flatMap((d) => d.versions ?? []).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  const sub =
    p.status === 'submitted'
      ? `v${latest?.number ?? 1} waiting for you`
      : p.status === 'completed'
        ? `Delivered ${formatDate(p.completedAt ?? p.updatedAt, { day: 'numeric', month: 'short' })}`
        : p.status === 'revision_requested'
          ? 'Changes sent'
          : latest
            ? `v${latest.number} sent`
            : 'Not started';
  return (
    <li className="grid items-center gap-x-4 gap-y-2 border-t border-line px-5 py-4 first:border-t-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_150px_minmax(0,1.1fr)_auto]">
      <div className="min-w-0">
        <Link to={`/projects/${p._id}`} className="block truncate font-bold hover:text-navy">
          {p.campaign?.title}
        </Link>
        <span className="text-[13px] text-steel">{sub}</span>
      </div>
      <ClientTag name={client.name} color={client.color} />
      <span className="flex min-w-0 items-center gap-2 text-[14px]">
        <Avatar name={p.creator?.displayName ?? ''} src={p.creator?.photoUrl} size="sm" />
        <span className="truncate">{p.creator?.displayName}</span>
      </span>
      <span>{p.status === 'submitted' ? <Pill tone="wait">Review needed</Pill> : <StatusPill status={p.status} />}</span>
      <span className="flex items-center gap-2.5">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <span className="block h-full rounded-full bg-navy" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="text-[13px] tabular-nums text-steel">
          {progress.approved} of {progress.total}
        </span>
      </span>
      <ButtonLink to={`/projects/${p._id}`} size="sm" variant="secondary" className="justify-self-start md:justify-self-end">
        Open
      </ButtonLink>
    </li>
  );
}

export default function AgencyOverview() {
  useDocumentTitle('Agency overview');
  const { profile } = useAuth();
  const { clientId, setClient } = useClientScope();
  const clientsQ = useQuery({ queryKey: ['mine', 'clients'], queryFn: endpoints.brand.clients });
  const clients = clientsQ.data ?? [];
  const active = clients.find((c) => c._id === clientId);
  const scope = active ? clientId : '';

  const openCampaigns = useQuery({ queryKey: ['mine', 'brand-campaigns', { status: 'open', limit: 1, client: scope }], queryFn: () => endpoints.brand.campaigns({ status: 'open', limit: 1, clientId: scope }) });
  const pending = useQuery({ queryKey: ['mine', 'brand-applications', { status: 'pending', limit: 1, client: scope }], queryFn: () => endpoints.brand.applications({ status: 'pending', limit: 1, clientId: scope }) });
  const projects = useQuery({ queryKey: ['mine', 'projects', 'brand', 'agency', scope], queryFn: () => endpoints.brand.projects({ limit: 50, clientId: scope }) });
  const approvals = useQuery({ queryKey: ['mine', 'approvals', scope], queryFn: () => endpoints.brand.approvals({ clientId: scope }) });

  const projectList = projects.data?.items ?? [];
  const activeProjects = projectList.filter((p) => !['completed', 'cancelled'].includes(p.status));
  const toReview = projectList.filter((p) => p.status === 'submitted').length;
  const waiting = (approvals.data?.items ?? []).filter((i) => i.status === 'awaiting' || i.status === 'answered');
  waiting.sort((a, b) => (a.status === 'answered' ? -1 : 1) - (b.status === 'answered' ? -1 : 1));
  const awaiting = approvals.data?.counts.awaiting;

  return (
    <>
      <PageHeader
        eyebrow={profile?.companyName}
        title={active ? active.name : 'All clients'}
        description="Same dashboard as a brand, plus clients, client tags and approval links."
        actions={
          <ButtonLink to={withClient('/brand/campaigns/new', scope)}>
            <Plus className="size-4" /> New brief for…
          </ButtonLink>
        }
      />

      {clientsQ.error ? (
        <ErrorState error={clientsQ.error} onRetry={clientsQ.refetch} />
      ) : (
        <div className="mt-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {clientsQ.isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[84px]" />)
            : clients.map((c) => <ClientStripCard key={c._id} client={c} active={c._id === scope} onPick={setClient} />)}
          <Link to="/brand/clients" className="flex min-h-[84px] items-center justify-center gap-2 rounded-lg border border-dashed border-line2 text-[14px] font-semibold text-slate hover:border-navy hover:text-navy">
            <Plus className="size-4" /> {clients.length ? 'Add client' : 'Add your first client'}
          </Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile variant="navy" label="Live campaigns" value={openCampaigns.data?.total} to={withClient('/brand/campaigns', scope)} hint={scope ? active?.name : `for ${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`} />
        <StatTile variant="grey" label="Active projects" value={projects.data ? activeProjects.length : undefined} to={withClient('/brand/projects', scope)} hint={`${toReview} ${toReview === 1 ? 'version' : 'versions'} to review`} />
        <StatTile variant="highlight" label="Awaiting client" value={awaiting} to={withClient('/brand/approvals', scope)} hint="approval links sent" />
        <StatTile variant="bone" label="Proposals to review" value={pending.data?.total} to={withClient('/brand/applications', scope)} hint="from creators" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <SectionHead
            title="Waiting on client · approval links"
            action={
              <Link to={withClient('/brand/approvals', scope)} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-navy hover:underline">
                All <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {approvals.isLoading ? (
            <Skeleton className="m-5 h-20" />
          ) : approvals.error ? (
            <div className="p-5">
              <ErrorState error={approvals.error} onRetry={approvals.refetch} />
            </div>
          ) : waiting.length === 0 ? (
            <p className="p-5 text-[14px] text-steel">Nothing is waiting on a client. Open a project that has a version to review and send its approval link.</p>
          ) : (
            <ul>
              {waiting.slice(0, 4).map((item) => (
                <WaitingRow key={item._id} item={item} clients={clients} />
              ))}
            </ul>
          )}
        </Card>
        <Card dark pad className="flex flex-col gap-2">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-mist">How client approval works</p>
          <h2 className="text-[24px] text-white">You review first. Then one link to the client.</h2>
          <p className="text-[14px] text-bone">
            The link opens without a login. Your client approves or asks for changes (a note is required). It comes back to you as advice: you confirm, so the creator hears it from you.
          </p>
          <p className="text-[13px] text-mist">UNIO does not email your client. You share the link yourself, and it works once, for 7 days.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[20px] tracking-[-0.02em]">Projects</h2>
          <div className="inline-flex max-w-full overflow-x-auto rounded-full border border-line2 bg-white p-[3px]" role="tablist" aria-label="Client">
            {[{ _id: '', name: 'All' }, ...clients].map((c) => (
              <button
                key={c._id || 'all'}
                role="tab"
                type="button"
                aria-selected={c._id === scope}
                onClick={() => setClient(c._id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${c._id === scope ? 'bg-navy text-white' : 'text-steel hover:text-ink'}`}
              >
                {c._id ? c.name.split(' ')[0] : c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_150px_minmax(0,1.1fr)_auto] gap-x-4 border-b border-line bg-soft px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-steel md:grid" aria-hidden>
          <span>Project</span>
          <span>Client</span>
          <span>Creator</span>
          <span>Status</span>
          <span>Deliverables</span>
          <span className="w-16" />
        </div>
        {projects.isLoading ? (
          <Skeleton className="m-5 h-32" />
        ) : projects.error ? (
          <div className="p-5">
            <ErrorState error={projects.error} onRetry={projects.refetch} />
          </div>
        ) : projectList.length === 0 ? (
          <div className="p-5">
            <Alert tone="info">{active ? `No projects for ${active.name} yet.` : 'No projects yet. Accept a creator’s proposal on one of your briefs to start one.'}</Alert>
          </div>
        ) : (
          <ul>
            {projectList.map((p) => (
              <ProjectRow key={p._id} p={p} clients={clients} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
