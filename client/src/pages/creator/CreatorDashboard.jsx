import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Circle } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader, Panel } from '../../components/layout/Layouts.jsx';
import { StatTile } from '../../components/dashboard/Kit.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { InvitationResponseButtons } from './CreatorInvitations.jsx';

function completeness(profile, portfolioCount) {
  const checks = [
    ['Bio', !!profile?.bio?.trim()],
    ['Location', !!profile?.location?.trim()],
    ['Skills', (profile?.skills?.length ?? 0) > 0],
    ['AI tools', (profile?.tools?.length ?? 0) > 0],
    ['Specialties', (profile?.specialties?.length ?? 0) > 0],
    ['Starting price', profile?.startingPrice != null],
    ['Portfolio piece', portfolioCount > 0],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { checks, percent: Math.round((done / checks.length) * 100) };
}

export default function CreatorDashboard() {
  useDocumentTitle('Creator dashboard');
  const { user } = useAuth();
  const profile = useQuery({ queryKey: ['mine', 'creator-profile'], queryFn: endpoints.creator.profile });
  const portfolio = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const apps = useQuery({ queryKey: ['mine', 'applications', { limit: 5 }], queryFn: () => endpoints.creator.applications({ limit: 5 }) });
  const pendingApps = useQuery({ queryKey: ['mine', 'applications', { status: 'pending', limit: 1 }], queryFn: () => endpoints.creator.applications({ status: 'pending', limit: 1 }) });
  const invites = useQuery({ queryKey: ['mine', 'invitations', { status: 'pending' }], queryFn: () => endpoints.creator.invitations({ status: 'pending', limit: 5 }) });
  const projects = useQuery({ queryKey: ['mine', 'projects', { limit: 5 }], queryFn: () => endpoints.creator.projects({ limit: 5 }) });
  const trust = useQuery({ queryKey: ['mine', 'verifications'], queryFn: endpoints.creator.verifications });
  // Approvals last 12 months: warn 30 days ahead, and say so once one has lapsed.
  const lapsing = (trust.data ?? []).filter((e) => e.type !== 'portfolio' && e.type !== 'workflow' && (e.expiringSoon || e.expired));

  const comp = profile.data && portfolio.data ? completeness(profile.data, portfolio.data.length) : null;
  const activeProjects = projects.data?.items.filter((p) => !['completed', 'cancelled'].includes(p.status)) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Hello, ${user.name.split(' ')[0]}`}
        description="Your applications, invitations and projects in one place."
        actions={
          <>
            <ButtonLink to="/campaigns">Find briefs</ButtonLink>
            {profile.data && (
              <ButtonLink to={`/creators/${profile.data._id}`} variant="secondary">
                View public profile
              </ButtonLink>
            )}
          </>
        }
      />

      {lapsing.length > 0 && (
        <div className="mb-4 space-y-2">
          {lapsing.map((e) => (
            <Alert key={e._id} tone="warning">
              {e.expired ? `Your ${e.subject} badge has expired and now shows as self-reported. ` : `Your ${e.subject} badge expires in ${e.expiresInDays} ${e.expiresInDays === 1 ? 'day' : 'days'}. `}
              <Link to="/creator/verification" className="font-semibold underline">Re-verify</Link>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Pending applications" value={pendingApps.data?.total} to="/creator/applications" />
        <StatTile label="Invitations to answer" value={invites.data?.total} to="/creator/invitations" />
        <StatTile label="Active projects" value={projects.data ? activeProjects.length : undefined} to="/creator/projects" />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Panel title="Invitations waiting for you" action={<Link to="/creator/invitations" className="text-sm text-navy hover:underline">All</Link>}>
            {invites.isLoading ? (
              <Skeleton className="h-20" />
            ) : invites.error ? (
              <ErrorState error={invites.error} onRetry={invites.refetch} />
            ) : invites.data.items.length === 0 ? (
              <p className="text-[15px] text-steel">No pending invitations. Brands can invite you directly from your public profile.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {invites.data.items.map((inv) => (
                  <li key={inv._id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="eyebrow">{inv.brand?.companyName}</p>
                      <Link to={`/campaigns/${inv.campaignId}`} className="font-semibold hover:text-navy">
                        {inv.campaign?.title}
                      </Link>
                    </div>
                    <InvitationResponseButtons invitation={inv} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent applications" action={<Link to="/creator/applications" className="text-sm text-navy hover:underline">All</Link>}>
            {apps.isLoading ? (
              <Skeleton className="h-24" />
            ) : apps.error ? (
              <ErrorState error={apps.error} onRetry={apps.refetch} />
            ) : apps.data.items.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[15px] text-steel">You haven’t applied to any campaigns yet.</p>
                <ButtonLink to="/campaigns" variant="subtle" size="sm">
                  Browse open briefs <ArrowRight className="size-3.5" />
                </ButtonLink>
              </div>
            ) : (
              <ul className="divide-y divide-line/60">
                {apps.data.items.map((a) => (
                  <li key={a._id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/campaigns/${a.campaignId}`} className="block truncate font-semibold hover:text-navy">
                        {a.campaign?.title ?? 'Campaign'}
                      </Link>
                      <p className="text-[13px] text-steel">
                        {a.brand?.companyName} · {formatDate(a.submittedAt)}
                      </p>
                    </div>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Active projects" action={<Link to="/creator/projects" className="text-sm text-navy hover:underline">All</Link>}>
            {projects.isLoading ? (
              <Skeleton className="h-16" />
            ) : activeProjects.length === 0 ? (
              <p className="text-[15px] text-steel">When a brand accepts your application or you accept an invitation, the project appears here.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {activeProjects.map((p) => (
                  <li key={p._id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <Link to={`/projects/${p._id}`} className="min-w-0 truncate font-semibold hover:text-navy">
                      {p.campaign?.title}
                    </Link>
                    <StatusPill status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Profile strength">
          {!comp ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div className="flex items-end justify-between">
                <p className="font-extrabold tracking-[-0.03em] text-5xl leading-none">{comp.percent}%</p>
                <p className="text-[13px] text-steel">complete</p>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuenow={comp.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-navy transition-[width] duration-700" style={{ width: `${comp.percent}%` }} />
              </div>
              <ul className="mt-5 space-y-2">
                {comp.checks.map(([label, ok]) => (
                  <li key={label} className={`flex items-center gap-2 text-[14px] ${ok ? 'text-ink' : 'text-steel'}`}>
                    {ok ? <Check className="size-4 text-navy" /> : <Circle className="size-3.5 text-steel" />}
                    {label}
                  </li>
                ))}
              </ul>
              {comp.percent < 100 && (
                <div className="mt-5 flex flex-col gap-2">
                  <ButtonLink to="/creator/profile/edit" variant="subtle" size="sm">
                    Complete profile
                  </ButtonLink>
                  <ButtonLink to="/creator/portfolio" variant="ghost" size="sm">
                    Add portfolio work
                  </ButtonLink>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
