import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApplicationCard } from '../../components/applications/ApplicationCard.jsx';
import { StatusTabs } from '../../components/dashboard/Kit.jsx';
import { InviteDialog } from '../../components/invitations/InviteDialog.jsx';
import { PageHeader, Panel } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '../../components/ui/Feedback.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatBudget, relativeDeadline } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { CampaignStatusButton } from './BrandCampaigns.jsx';

function Recommendations({ campaign }) {
  const [inviting, setInviting] = useState(null);
  const recs = useQuery({
    queryKey: ['mine', 'recommendations', campaign._id],
    queryFn: () => endpoints.brand.recommendations(campaign._id),
  });
  const invites = useQuery({
    queryKey: ['mine', 'brand-invitations', 'all'],
    queryFn: () => endpoints.brand.invitations({ limit: 50 }),
  });

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-4 text-forest" strokeWidth={1.75} /> Suggested creators
        </span>
      }
    >
      <p className="mb-4 text-[13px] text-muted">
        Ranked by overlap with your skills, tools, category and budget. A starting point for your shortlist, not a prediction.
      </p>
      {recs.isLoading ? (
        <Skeleton className="h-40" />
      ) : recs.error ? (
        <ErrorState error={recs.error} onRetry={recs.refetch} />
      ) : recs.data.length === 0 ? (
        <p className="text-[14px] text-muted">No available creators to suggest yet.</p>
      ) : (
        <ul className="space-y-4">
          {recs.data.slice(0, 6).map(({ creator, score, reasons }) => {
            const existing = invites.data?.items.find((i) => i.campaignId === campaign._id && i.creatorId === creator._id);
            return (
              <li key={creator._id} className="border-b border-beige/60 pb-4 last:border-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <Avatar name={creator.displayName} src={creator.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/creators/${creator._id}`} className="truncate font-medium hover:text-forest">
                        {creator.displayName}
                      </Link>
                      <span className="font-mono text-xs text-forest" title="Match score out of 100">
                        {score}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-mint" aria-hidden>
                      <div className="h-full bg-forest/70" style={{ width: `${score}%` }} />
                    </div>
                    {reasons.length > 0 && <p className="mt-1.5 text-[12px] leading-snug text-muted">{reasons.slice(0, 2).join(' · ')}</p>}
                    <div className="mt-2">
                      {existing && existing.status !== 'cancelled' && existing.status !== 'declined' ? (
                        <StatusPill status={existing.status} />
                      ) : (
                        <Button variant="subtle" size="sm" onClick={() => setInviting(creator)} disabled={campaign.status !== 'open'}>
                          Invite
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {campaign.status !== 'open' && <p className="mt-4 text-[12px] text-muted">Open the campaign to send invitations.</p>}
      {inviting && (
        <InviteDialog
          open
          onClose={() => setInviting(null)}
          creator={inviting}
          existingInvitations={(invites.data?.items ?? []).filter((i) => i.creatorId === inviting._id)}
        />
      )}
    </Panel>
  );
}

export default function CampaignApplicants() {
  const { id } = useParams();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['mine', 'campaign-applications', id, { status, page }],
    queryFn: () => endpoints.brand.campaignApplications(id, { status, page, limit: 10 }),
  });
  const campaign = query.data?.campaign;
  useDocumentTitle(campaign ? `Applicants · ${campaign.title}` : 'Applicants');

  if (query.isLoading) return <PageLoader label="Loading applicants" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <Link to="/brand/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>
      <PageHeader
        eyebrow={`${campaign.category} · ${formatBudget(campaign.budgetMin, campaign.budgetMax)} · ${relativeDeadline(campaign.deadline)}`}
        title={campaign.title}
        actions={
          <>
            <StatusPill status={campaign.status} className="self-center" />
            <CampaignStatusButton campaign={campaign} />
            <ButtonLink to={`/brand/campaigns/${id}/edit`} variant="secondary" size="sm">
              Edit
            </ButtonLink>
            {campaign.status === 'open' && (
              <ButtonLink to={`/campaigns/${id}`} variant="ghost" size="sm">
                Public page
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <StatusTabs statuses={['pending', 'accepted', 'rejected', 'withdrawn']} value={status} onChange={(s) => { setStatus(s); setPage(1); }} />
          {query.data.items.length === 0 ? (
            <EmptyState icon={Inbox} title={status ? 'Nothing here' : 'No applications yet'}>
              {campaign.status === 'open'
                ? 'Creators can apply from the public campaign page. You can also invite suggested creators directly.'
                : 'This campaign isn’t open, so creators can’t apply right now.'}
            </EmptyState>
          ) : (
            <>
              <ul className="space-y-3">
                {query.data.items.map((a) => (
                  <ApplicationCard key={a._id} application={a} />
                ))}
              </ul>
              <div className="mt-8">
                <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
              </div>
            </>
          )}
        </section>
        <Recommendations campaign={campaign} />
      </div>
    </>
  );
}
