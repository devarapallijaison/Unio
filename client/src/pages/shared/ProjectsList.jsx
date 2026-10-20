import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { StatusTabs } from '../../components/dashboard/Kit.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { relativeDeadline } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

export function deliverableProgress(project) {
  const list = project.deliverables ?? [];
  const approved = list.filter((d) => d.status === 'approved').length;
  return { approved, total: list.length, percent: list.length ? Math.round((approved / list.length) * 100) : 0 };
}

export default function ProjectsList({ role }) {
  useDocumentTitle('Projects');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const fetcher = role === 'brand' ? endpoints.brand.projects : endpoints.creator.projects;
  const query = useQuery({
    queryKey: ['mine', 'projects', role, { status, page }],
    queryFn: () => fetcher({ status, page, limit: 10 }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Engagements"
        title="Projects"
        description={
          role === 'brand'
            ? 'Every accepted creator, with deliverables you can approve or send back.'
            : 'Work you’ve been hired for. Submit each deliverable with a media link.'
        }
      />
      <StatusTabs
        statuses={['not_started', 'in_progress', 'submitted', 'revision_requested', 'completed', 'cancelled']}
        value={status}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
      />
      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={status ? 'Nothing here' : 'No projects yet'}
          action={
            role === 'brand' ? (
              <ButtonLink to="/brand/campaigns">Review applicants</ButtonLink>
            ) : (
              <ButtonLink to="/campaigns">Find briefs</ButtonLink>
            )
          }
        >
          {role === 'brand'
            ? 'Accept an application or have a creator accept your invitation to start a project.'
            : 'Projects appear when a brand accepts your application or you accept an invitation.'}
        </EmptyState>
      ) : (
        <>
          <ul className="overflow-hidden rounded-lg border border-line/70 bg-white">
            {query.data.items.map((p) => {
              const prog = deliverableProgress(p);
              const counterpart = role === 'brand' ? p.creator?.displayName : p.brand?.companyName;
              return (
                <li key={p._id} className="border-b border-line/60 last:border-0">
                  <Link to={`/projects/${p._id}`} className="group grid gap-4 px-5 py-5 hover:bg-soft/40 md:grid-cols-12 md:items-center">
                    <div className="flex min-w-0 items-center gap-3 md:col-span-6">
                      <Avatar name={counterpart ?? '?'} src={role === 'brand' ? p.creator?.photoUrl : undefined} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold group-hover:text-navy">{p.campaign?.title}</p>
                        <p className="truncate text-[13px] text-steel">
                          {role === 'brand' ? 'Creator' : 'Brand'}: {counterpart} · via {p.sourceType}
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="flex items-center justify-between text-[12px] text-steel">
                        <span>
                          {prog.approved}/{prog.total} approved
                        </span>
                        <span>{relativeDeadline(p.campaign?.deadline)}</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-soft">
                        <div className="h-full bg-navy" style={{ width: `${prog.percent}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:col-span-3 md:justify-end">
                      <StatusPill status={p.status} />
                      <ArrowRight className="size-4 text-steel transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-8">
            <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </>
  );
}
