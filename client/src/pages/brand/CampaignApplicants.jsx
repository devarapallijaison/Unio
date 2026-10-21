import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Inbox, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toolStateFor } from '../../components/creators/CreatorCard.jsx';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { DemoBadge, StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Segmented } from '../../components/ui/Form.jsx';
import { MatchRing, Reasons, ScoreBars } from '../../components/ui/Match.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ToolChip, TrustLevelTag } from '../../components/ui/Trust.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { CampaignStatusButton } from './BrandCampaigns.jsx';

/* v9 B4 — applicants sorted by match; open a row to see the pitch, samples and the score breakdown (F4). */

const TABS = [
  ['', 'All'],
  ['pending', 'To review'],
  ['accepted', 'Hired'],
  ['rejected', 'Not selected'],
];

function ApplicantRow({ application, campaign, open, onToggle, taxonomy }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const c = application.creator ?? {};
  const m = application.match;
  const review = useMutation({
    mutationFn: (status) => endpoints.brand.reviewApplication(application._id, status),
    onSuccess: (data, status) => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      if (status === 'accepted') {
        toast.success(`${c.displayName ?? 'Creator'} is hired — project created.`);
        if (data.project) navigate(`/projects/${data.project._id}`);
      } else toast.success('Marked as not selected.');
    },
  });
  const tools = (campaign.requiredTools?.length ? campaign.requiredTools : c.tools ?? []).slice(0, 3);
  const line = [labelOf(taxonomy, 'categories', c.category), c.location, c.ratingAvg ? `★ ${c.ratingAvg.toFixed(1)}` : null].filter(Boolean).join(' · ');

  return (
    <li className={`overflow-hidden rounded-lg border bg-white ${open ? 'border-navy ring-1 ring-navy' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-3.5 px-4 py-3.5 sm:flex-nowrap sm:px-[18px]">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
          {m ? <MatchRing score={m.score} /> : null}
          <Avatar name={c.displayName ?? '?'} src={c.photoUrl} size="md" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <b className="text-[16px] tracking-[-0.02em]">{c.displayName}</b>
              {c.trustLevel > 1 && <TrustLevelTag level={c.trustLevel} />}
              {c.isDemo && <DemoBadge label="Demo" />}
            </span>
            <span className="block truncate text-[13px] text-steel">{line}</span>
          </span>
          <ChevronDown className={`ml-auto size-4 shrink-0 text-steel transition-transform sm:hidden ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex flex-wrap items-center gap-1.5 max-lg:hidden">
          {tools.map((t) => (
            <ToolChip key={t} name={t} state={toolStateFor(c, t)} />
          ))}
        </div>
        <b className="w-[78px] text-right tabular-nums">{application.proposedPrice != null ? formatINR(application.proposedPrice) : '—'}</b>
        <ButtonLink to={`/creators/${application.creatorId}`} variant="secondary" size="sm">
          Profile
        </ButtonLink>
        {application.status === 'pending' ? (
          <ConfirmAction
            title={`Hire ${c.displayName ?? 'this creator'}?`}
            body="Accepting creates a project with this campaign’s deliverables and rights. You can still hire other applicants."
            confirmLabel="Hire and create project"
            pending={review.isPending && review.variables === 'accepted'}
            error={review.variables === 'accepted' ? review.error : null}
            onConfirm={() => review.mutateAsync('accepted')}
            trigger={(o) => (
              <Button size="sm" onClick={o}>
                Hire
              </Button>
            )}
          />
        ) : (
          <StatusPill status={application.status} />
        )}
      </div>
      {open && (
        <div className="grid gap-6 border-t border-line bg-soft/50 px-[18px] py-5 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="eyebrow">Pitch</p>
            <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed">{application.proposal}</p>
            {application.samplePieces?.length > 0 && (
              <div className="mt-3 flex gap-2">
                {application.samplePieces.map((p) => (
                  <MediaFrame key={p._id} item={p} aspect="aspect-square" showLabel={false} hover={false} className="w-14" />
                ))}
              </div>
            )}
            {application.status === 'pending' && (
              <ConfirmAction
                title="Mark as not selected?"
                body={`${c.displayName ?? 'The creator'} will see that this application wasn’t selected.`}
                confirmLabel="Not selected"
                variant="danger"
                pending={review.isPending && review.variables === 'rejected'}
                error={review.variables === 'rejected' ? review.error : null}
                onConfirm={() => review.mutateAsync('rejected')}
                trigger={(o) => (
                  <Button variant="ghost" size="sm" className="mt-4" onClick={o}>
                    Not selected
                  </Button>
                )}
              />
            )}
          </div>
          {m && (
            <div className="min-w-0">
              <p className="eyebrow">Why {m.score}%</p>
              <ScoreBars className="mt-3" percent rows={m.breakdown.map((b) => ({ label: b.label.replace(' (backed by work)', ''), points: b.points, max: b.max }))} />
              <Reasons className="mt-3" items={m.reasons} />
              {m.warnings.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12.5px] text-wait">
                  {m.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-1.5">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function CampaignApplicants() {
  const { id } = useParams();
  const [status, setStatus] = useState('');
  const [openId, setOpenId] = useState(null);
  const query = useQuery({
    queryKey: ['mine', 'campaign-applications', id, { status }],
    queryFn: () => endpoints.brand.campaignApplications(id, { status, limit: 50 }),
  });
  const all = useQuery({ queryKey: ['mine', 'campaign-applications', id, 'count'], queryFn: () => endpoints.brand.campaignApplications(id, { limit: 1 }) });
  const campaign = query.data?.campaign;
  const { data: taxonomy } = useTaxonomy();
  useDocumentTitle(campaign ? `Applicants · ${campaign.title}` : 'Applicants');

  if (query.isLoading) return <PageLoader label="Loading applicants" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const items = [...query.data.items].sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0));
  const first = openId ?? items[0]?._id;

  return (
    <>
      <PageHeader
        eyebrow={campaign.title}
        title={`Applicants · ${all.data?.total ?? query.data.total}`}
        description="Sorted by match. Open a row to see the reasons."
        actions={<Segmented label="Filter applicants" value={status} onChange={setStatus} options={TABS.map(([value, label]) => ({ value, label }))} />}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        <StatusPill status={campaign.status} />
        <CampaignStatusButton campaign={campaign} />
        <ButtonLink to={`/brand/campaigns/${id}/edit`} variant="ghost" size="sm">
          Edit brief
        </ButtonLink>
        <ButtonLink to={`/brand/recommended?campaign=${id}`} variant="ghost" size="sm">
          <Sparkles className="size-3.5" /> Recommended creators
        </ButtonLink>
        {campaign.status === 'open' && (
          <Link to={`/campaigns/${id}`} className="text-steel underline-offset-2 hover:underline">
            Public page
          </Link>
        )}
      </div>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={status ? 'Nothing here' : 'No applications yet'}
            action={
              <ButtonLink to={`/brand/recommended?campaign=${id}`}>
                <Sparkles className="size-4" /> See recommended creators
              </ButtonLink>
            }
          >
            {campaign.status === 'open' ? 'Creators apply from the public brief. You can also invite your best matches.' : 'This brief isn’t open, so creators can’t apply right now.'}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <ApplicantRow
                key={a._id}
                application={a}
                campaign={campaign}
                taxonomy={taxonomy}
                open={first === a._id}
                onToggle={() => setOpenId(first === a._id ? '__none' : a._id)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
