import { useQuery } from '@tanstack/react-query';
import { Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { AvailabilityDot, toolStateFor } from '../../components/creators/CreatorCard.jsx';
import { InviteDialog } from '../../components/invitations/InviteDialog.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { DemoBadge, StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { MatchRing, Reasons, ScoreBars } from '../../components/ui/Match.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { ToolChip, TrustLevelTag } from '../../components/ui/Trust.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/* v9 B5 — AI matching (rule-based, explainable): the top match in full, the next three as cards. */

const WEIGHTS_NOTE =
  'Weights (proposed, not final): content type 20 · skills 20 · tools 15 · industry 10 · budget 10 · trust 10 · format 5 · language 5 · availability 5. Self-reported tools count half; skills count only when a portfolio piece shows them.';

function Warnings({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1 rounded-md border border-wait-ln bg-wait-bg px-3.5 py-2.5 text-[13px] text-wait">
      {items.map((w) => (
        <li key={w} className="flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
        </li>
      ))}
    </ul>
  );
}

function InviteAction({ rec, invites, campaign, onInvite, className = '', variant }) {
  const existing = invites.find((i) => i.campaignId === campaign._id && i.creatorId === rec.creator._id && !['cancelled', 'declined'].includes(i.status));
  if (existing) return <StatusPill status={existing.status} className={className} />;
  return (
    <Button variant={variant} className={className} onClick={() => onInvite(rec.creator)} disabled={campaign.status !== 'open'}>
      {variant === 'secondary' ? 'View & invite' : 'Invite to brief'}
    </Button>
  );
}

export default function RecommendedCreators() {
  useDocumentTitle('Recommended creators');
  const [params, setParams] = useSearchParams();
  const { data: taxonomy } = useTaxonomy();
  const [inviting, setInviting] = useState(null);
  const campaigns = useQuery({ queryKey: ['mine', 'brand-campaigns', { status: 'open', limit: 50 }], queryFn: () => endpoints.brand.campaigns({ status: 'open', limit: 50 }) });
  const list = campaigns.data?.items ?? [];
  const campaign = list.find((c) => c._id === params.get('campaign')) ?? list[0];
  const recs = useQuery({
    queryKey: ['mine', 'recommendations', campaign?._id],
    queryFn: () => endpoints.brand.recommendations(campaign._id),
    enabled: !!campaign,
  });
  const invites = useQuery({ queryKey: ['mine', 'brand-invitations', 'all'], queryFn: () => endpoints.brand.invitations({ limit: 50 }) });
  const inviteList = invites.data?.items ?? [];

  const [top, ...rest] = recs.data ?? [];
  const typeLine = (c) => [labelOf(taxonomy, 'categories', c.category)?.replace(/s$/, ''), labelOf(taxonomy, 'specializations', c.specializations?.[0])].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        eyebrow={campaign ? `AI matching · ${campaign.title}` : 'AI matching'}
        title="Your best matches"
        description="We never hide why someone ranks high. Every score has its reasons."
        actions={
          list.length > 0 && (
            <select
              aria-label="Campaign"
              value={campaign?._id ?? ''}
              onChange={(e) => setParams({ campaign: e.target.value })}
              className="h-11 max-w-[260px] rounded-md border border-line bg-white px-3 text-[14px] font-semibold"
            >
              {list.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          )
        }
      />
      <div className="mt-6 space-y-5">
        {campaigns.isLoading || recs.isLoading ? (
          <Skeleton className="h-80" />
        ) : campaigns.error || recs.error ? (
          <ErrorState error={campaigns.error ?? recs.error} onRetry={() => (campaigns.error ? campaigns.refetch() : recs.refetch())} />
        ) : !campaign ? (
          <EmptyState icon={Sparkles} title="Publish a brief to see matches" action={<ButtonLink to="/brand/campaigns/new">New brief with AI</ButtonLink>}>
            Matches are worked out for each open brief from content type, skills shown in real work, tools, industry, budget and trust.
          </EmptyState>
        ) : !top ? (
          <EmptyState icon={Sparkles} title="No available creators yet">
            Creators who aren’t taking work are left out of matches.
          </EmptyState>
        ) : (
          <>
            <Card pad className="sm:p-6">
              <div className="flex flex-wrap items-start gap-5">
                <MatchRing score={top.score} size="lg" dark />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[26px] sm:text-[30px]">{top.creator.displayName}</h2>
                    {top.creator.trustLevel > 1 && <TrustLevelTag level={top.creator.trustLevel} />}
                    {top.creator.isDemo && <DemoBadge label="Demo" />}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] text-steel">
                    {[typeLine(top.creator), top.creator.location, top.creator.startingPrice != null ? `from ${formatINR(top.creator.startingPrice)}` : null].filter(Boolean).join(' · ')}
                    <span className="inline-flex items-center gap-1">
                      · <AvailabilityDot value={top.creator.availability} />
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(campaign.requiredTools?.length ? campaign.requiredTools : top.creator.tools ?? []).slice(0, 4).map((t) => (
                      <ToolChip key={t} name={t} state={toolStateFor(top.creator, t)} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2.5 max-md:hidden">
                  {top.portfolioPreview.map((p) => (
                    <MediaFrame key={p._id} item={p} aspect="aspect-[4/5]" showLabel={false} className="w-[110px]" />
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-6 border-t border-line pt-6 lg:grid-cols-2">
                <div>
                  <p className="eyebrow mb-3">Score breakdown</p>
                  <ScoreBars rows={top.breakdown.map((b) => ({ label: b.label.replace(' (backed by work)', ''), points: b.points, max: b.max }))} />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="eyebrow mb-3">Reasons</p>
                    <Reasons items={top.reasons} className="text-[13.5px]" />
                  </div>
                  <Warnings items={top.warnings} />
                  <div className="flex flex-wrap gap-2">
                    <InviteAction rec={top} invites={inviteList} campaign={campaign} onInvite={setInviting} />
                    <ButtonLink to={`/creators/${top.creator._id}`} variant="secondary">
                      Profile
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </Card>

            {rest.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                {rest.slice(0, 3).map((r) => (
                  <Card key={r.creator._id} pad className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-3">
                      <MatchRing score={r.score} />
                      <div className="min-w-0">
                        <b className="block truncate text-[16px]">{r.creator.displayName}</b>
                        <span className="block truncate text-[13px] text-steel">{typeLine(r.creator)}</span>
                      </div>
                    </div>
                    <MediaFrame item={r.portfolioPreview[0] ?? { _id: r.creator._id, title: r.creator.displayName }} aspect="aspect-[16/10]" showLabel={false} />
                    <Reasons items={[...r.reasons.slice(0, 2), ...(r.creator.startingPrice != null ? [`From ${formatINR(r.creator.startingPrice)}`] : [])]} className="text-[13px]" />
                    <InviteAction rec={r} invites={inviteList} campaign={campaign} onInvite={setInviting} variant="secondary" className="mt-auto w-full" />
                  </Card>
                ))}
              </div>
            )}
            <p className="text-[13px] text-steel">{WEIGHTS_NOTE}</p>
          </>
        )}
      </div>
      {inviting && (
        <InviteDialog open onClose={() => setInviting(null)} creator={inviting} existingInvitations={inviteList.filter((i) => i.creatorId === inviting._id)} />
      )}
    </>
  );
}
