import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { ApplicationCard } from '../../components/applications/ApplicationCard.jsx';
import { StatTile } from '../../components/dashboard/Kit.jsx';
import { PageHeader, Panel } from '../../components/layout/Layouts.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { ButtonLink } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { relativeDeadline } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

export default function BrandDashboard() {
  useDocumentTitle('Brand dashboard');
  const { profile } = useAuth();
  const campaigns = useQuery({ queryKey: ['mine', 'brand-campaigns', { limit: 6 }], queryFn: () => endpoints.brand.campaigns({ limit: 6 }) });
  const openCampaigns = useQuery({ queryKey: ['mine', 'brand-campaigns', { status: 'open', limit: 1 }], queryFn: () => endpoints.brand.campaigns({ status: 'open', limit: 1 }) });
  const pending = useQuery({ queryKey: ['mine', 'brand-applications', { status: 'pending', limit: 3 }], queryFn: () => endpoints.brand.applications({ status: 'pending', limit: 3 }) });
  const projects = useQuery({ queryKey: ['mine', 'projects', 'brand', { status: 'in_progress' }], queryFn: () => endpoints.brand.projects({ limit: 50 }) });
  const invites = useQuery({ queryKey: ['mine', 'brand-invitations', { status: 'pending', limit: 1 }], queryFn: () => endpoints.brand.invitations({ status: 'pending', limit: 1 }) });

  const activeProjects = projects.data?.items.filter((p) => !['completed', 'cancelled'].includes(p.status)) ?? [];
  const awaitingReview = activeProjects.filter((p) => p.status === 'submitted' || p.deliverables?.some((d) => d.status === 'submitted'));

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={profile?.companyName ?? 'Your brand'}
        description="Briefs, proposals and active work at a glance."
        actions={
          <ButtonLink to="/brand/campaigns/new">
            <Plus className="size-4" /> New campaign
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Open campaigns" value={openCampaigns.data?.total} to="/brand/campaigns" />
        <StatTile label="Proposals to review" value={pending.data?.total} to="/brand/applications" />
        <StatTile label="Active projects" value={projects.data ? activeProjects.length : undefined} to="/brand/projects" />
        <StatTile label="Pending invitations" value={invites.data?.total} to="/brand/invitations" />
      </div>

      {awaitingReview.length > 0 && (
        <div className="mt-6 rounded-lg border border-beige bg-sand/60 px-5 py-4">
          <p className="text-[15px]">
            <span className="font-medium">{awaitingReview.length} project{awaitingReview.length > 1 ? 's have' : ' has'} work waiting for your review.</span>{' '}
            {awaitingReview.slice(0, 3).map((p, i) => (
              <span key={p._id}>
                {i > 0 && ', '}
                <Link to={`/projects/${p._id}`} className="text-forest underline-offset-4 hover:underline">
                  {p.campaign?.title}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-sans text-[15px] font-semibold">Latest proposals</h2>
            <Link to="/brand/applications" className="text-sm text-forest hover:underline">
              All applications
            </Link>
          </div>
          {pending.isLoading ? (
            <Skeleton className="h-48" />
          ) : pending.error ? (
            <ErrorState error={pending.error} onRetry={pending.refetch} />
          ) : pending.data.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-beige bg-white/60 px-5 py-8 text-[15px] text-muted">
              No proposals waiting. Open campaigns receive applications from the public directory, or you can{' '}
              <Link to="/creators" className="text-forest underline">invite creators</Link>.
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.data.items.map((a) => (
                <ApplicationCard key={a._id} application={a} showCampaign />
              ))}
            </ul>
          )}
        </section>

        <Panel title="Your campaigns" action={<Link to="/brand/campaigns" className="text-sm text-forest hover:underline">Manage</Link>}>
          {campaigns.isLoading ? (
            <Skeleton className="h-40" />
          ) : campaigns.error ? (
            <ErrorState error={campaigns.error} onRetry={campaigns.refetch} />
          ) : campaigns.data.items.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[15px] text-muted">You haven’t created a campaign yet.</p>
              <ButtonLink to="/brand/campaigns/new" variant="subtle" size="sm">
                Write your first brief
              </ButtonLink>
            </div>
          ) : (
            <ul className="divide-y divide-beige/60">
              {campaigns.data.items.map((c) => (
                <li key={c._id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/brand/campaigns/${c._id}/applicants`} className="min-w-0 font-medium leading-snug hover:text-forest">
                      {c.title}
                    </Link>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {c.applicationCounts.total} applications
                    {c.applicationCounts.pending > 0 && ` · ${c.applicationCounts.pending} new`} · {relativeDeadline(c.deadline)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
