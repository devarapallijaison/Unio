import { useQuery } from '@tanstack/react-query';
import { FolderKanban, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Pill, StatusPill } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Segmented } from '../../components/ui/Form.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { ClientTag } from '../../components/agency/ClientBadge.jsx';
import { useClientScope } from '../../lib/clientScope.js';
import { formatDate } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/* v9 B7 (brand kanban) and C6 (creator cards). Versions, feedback and messages live inside each project. */

const short = (d) => formatDate(d, { day: 'numeric', month: 'short' });

export function deliverableProgress(project) {
  const list = project.deliverables ?? [];
  const approved = list.filter((d) => d.status === 'approved').length;
  return { approved, total: list.length, percent: list.length ? Math.round((approved / list.length) * 100) : 0 };
}

const latestVersion = (p) =>
  (p.deliverables ?? [])
    .flatMap((d) => d.versions ?? [])
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt) || b.number - a.number)[0];
const lastFeedbackAt = (p) =>
  (p.deliverables ?? [])
    .flatMap((d) => (d.versions ?? []).map((v) => v.feedback?.at))
    .filter(Boolean)
    .sort()
    .at(-1);

function footnote(p, role) {
  const v = latestVersion(p);
  const due = p.campaign?.deadline ? `due ${short(p.campaign.deadline)}` : null;
  switch (p.status) {
    case 'submitted':
      return role === 'brand' ? `v${v?.number ?? 1} waiting for you` : `v${v?.number ?? 1} with the brand`;
    case 'revision_requested':
      return role === 'brand' ? `Changes sent ${short(lastFeedbackAt(p))}` : [`Upload v${(v?.number ?? 0) + 1}`, due].filter(Boolean).join(' · ');
    case 'completed':
      return `Delivered ${short(p.completedAt ?? p.updatedAt)}${role === 'creator' ? ' · ★ added' : ''}`;
    case 'cancelled':
      return 'Cancelled';
    default:
      return v ? [`v${v.number} sent`, due].filter(Boolean).join(' · ') : ['Not started', due].filter(Boolean).join(' · ');
  }
}

function Unread({ n }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white" title={`${n} unread message${n > 1 ? 's' : ''}`}>
      <MessageSquare className="size-3" /> {n}
    </span>
  );
}

function Progress({ p, showPercent }) {
  const prog = deliverableProgress(p);
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="block h-full rounded-full bg-navy" style={{ width: `${prog.percent}%` }} />
      </span>
      <span className="shrink-0 text-[13px] tabular-nums text-steel">{showPercent ? `${prog.percent}%` : `${prog.approved} of ${prog.total}`}</span>
    </div>
  );
}

function KanbanCard({ p }) {
  return (
    <Link to={`/projects/${p._id}`} className="block space-y-3 rounded-md border border-line bg-white p-3.5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <b className="text-[15px] leading-snug">{p.campaign?.title}</b>
        <Unread n={p.unreadCount} />
      </div>
      {p.clientName && <ClientTag name={p.clientName} />}
      <div className="flex items-center gap-2 text-[13.5px]">
        <Avatar name={p.creator?.displayName ?? ''} src={p.creator?.photoUrl} size="sm" /> {p.creator?.displayName}
      </div>
      <Progress p={p} />
      <p className="text-[13px] text-slate">{footnote(p, 'brand')}</p>
    </Link>
  );
}

const COLUMNS = [
  ['In progress', ['not_started', 'in_progress']],
  ['Review needed', ['submitted']],
  ['Changes requested', ['revision_requested']],
  ['Completed', ['completed']],
];

function Kanban({ items }) {
  return (
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map(([title, statuses]) => {
        const col = items.filter((p) => statuses.includes(p.status));
        return (
          <section key={title} aria-label={title} className="min-h-[300px] rounded-lg bg-[#e3e7e7] p-3">
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <h2 className="text-[15px] tracking-[-0.01em]">{title}</h2>
              <span className="text-[13px] tabular-nums text-steel">{col.length}</span>
            </div>
            <div className="space-y-2.5">
              {col.map((p) => (
                <KanbanCard key={p._id} p={p} />
              ))}
              {!col.length && <p className="px-1 py-6 text-center text-[13px] text-steel">Nothing here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CreatorCard({ p, role = 'creator' }) {
  const deliverables = (p.deliverables ?? []).map((d) => d.title).join(' · ');
  return (
    <Link to={`/projects/${p._id}`} className="block space-y-3.5 rounded-lg border border-line bg-white p-5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <b className="text-[16px] leading-snug">{p.campaign?.title}</b>
        <span className="flex shrink-0 items-center gap-2">
          <Unread n={p.unreadCount} />
          {p.status === 'submitted' ? <Pill tone="wait">With the brand</Pill> : <StatusPill status={p.status} />}
        </span>
      </div>
      <p className="truncate text-[13.5px] text-steel">
        {p.brand?.companyName}
        {deliverables ? ` · ${deliverables}` : ''}
      </p>
      <Progress p={p} showPercent />
      <p className="text-[13.5px]">{footnote(p, role)}</p>
    </Link>
  );
}

export default function ProjectsList({ role }) {
  useDocumentTitle('Projects');
  const [tab, setTab] = useState('active');
  const fetcher = role === 'brand' ? endpoints.brand.projects : endpoints.creator.projects;
  const { clientId } = useClientScope();
  const query = useQuery({
    queryKey: ['mine', 'projects', role, 'all', role === 'brand' ? clientId : ''],
    queryFn: () => fetcher({ limit: 50, ...(role === 'brand' ? { clientId } : {}) }),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const items = query.data?.items ?? [];
  const done = items.filter((p) => ['completed', 'cancelled'].includes(p.status));
  const active = items.filter((p) => !['completed', 'cancelled'].includes(p.status));

  return (
    <>
      <PageHeader
        title="Projects"
        description={role === 'brand' ? 'Versions, feedback and messages live inside each project.' : undefined}
        actions={
          role === 'brand' && items.length > 0 ? (
            <Segmented
              label="Projects"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: `Active · ${active.length}` },
                { value: 'done', label: `Completed · ${done.length}` },
              ]}
            />
          ) : null
        }
      />
      <div className="mt-6">
        {query.isLoading ? (
          <Skeleton className="h-60" />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            action={role === 'brand' ? <ButtonLink to="/brand/campaigns">Review applicants</ButtonLink> : <ButtonLink to="/campaigns">Find briefs</ButtonLink>}
          >
            {role === 'brand'
              ? 'Accept an application or have a creator accept your invitation to start a project.'
              : 'Projects appear when a brand accepts your application or you accept an invitation.'}
          </EmptyState>
        ) : role === 'brand' ? (
          tab === 'active' ? (
            <Kanban items={items.filter((p) => p.status !== 'cancelled')} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {done.map((p) => (
                <CreatorCard key={p._id} role="brand" p={{ ...p, brand: { companyName: p.creator?.displayName } }} />
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((p) => (
              <CreatorCard key={p._id} p={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
