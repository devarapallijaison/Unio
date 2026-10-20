import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Globe, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApplyDialog } from '../../components/applications/ApplyDialog.jsx';
import { DemoBadge, StatusPill, Tag } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatBudget, formatDate, relativeDeadline } from '../../lib/format.js';
import { authLink } from '../../lib/returnTo.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from './NotFoundPage.jsx';

function ApplyPanel({ campaign, viewer, user, onApply, roleNotice }) {
  if (viewer?.isOwner) {
    return (
      <>
        <p className="text-[15px]">This is your campaign{campaign.status !== 'open' ? ` (${campaign.status})` : ''}.</p>
        <div className="mt-4 flex flex-col gap-2">
          <ButtonLink to={`/brand/campaigns/${campaign._id}/applicants`}>Review applicants</ButtonLink>
          <ButtonLink to={`/brand/campaigns/${campaign._id}/edit`} variant="secondary">
            Edit campaign
          </ButtonLink>
        </div>
      </>
    );
  }
  if (viewer?.application) {
    return (
      <>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">You applied</p>
          <StatusPill status={viewer.application.status} />
        </div>
        <p className="mt-2 text-[13px] text-steel">Submitted {formatDate(viewer.application.submittedAt)}</p>
        <ButtonLink to="/creator/applications" variant="secondary" className="mt-4 w-full">
          View my applications
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      <Button size="lg" className="w-full" onClick={onApply}>
        Apply to this brief
      </Button>
      {!user && <p className="mt-2 text-center text-[13px] text-steel">You’ll sign in with a creator account first. Nothing is sent until you confirm.</p>}
      {roleNotice && user?.role === 'brand' && (
        <Alert tone="info" className="mt-4">
          Applications are submitted by creator accounts. You’re signed in as a brand — you can{' '}
          <Link to="/brand/campaigns/new" className="underline">
            post your own brief
          </Link>{' '}
          or <Link to="/creators" className="underline">invite creators</Link>.
        </Alert>
      )}
    </>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [applyOpen, setApplyOpen] = useState(false);
  const [roleNotice, setRoleNotice] = useState(false);

  const query = useQuery({ queryKey: ['pub', 'campaign', id, user?._id ?? 'guest'], queryFn: () => endpoints.campaigns.get(id) });
  const campaign = query.data?.campaign;
  const viewer = query.data?.viewer;
  useDocumentTitle(campaign?.title ?? 'Campaign');

  // Resume the apply flow after sign-in: open the form for review, never auto-submit.
  useEffect(() => {
    if (params.get('intent') !== 'apply' || !campaign || !user) return;
    if (user.role === 'creator' && !viewer?.application) setApplyOpen(true);
    if (user.role === 'brand') setRoleNotice(true);
    setParams((p) => {
      p.delete('intent');
      return p;
    }, { replace: true });
  }, [params, campaign, viewer, user, setParams]);

  const onApply = () => {
    if (!user) return navigate(authLink('login', `/campaigns/${id}?intent=apply`));
    if (user.role !== 'creator') return setRoleNotice(true);
    setApplyOpen(true);
  };

  if (query.isLoading) return <PageLoader label="Loading brief" />;
  if (query.error?.status === 404 || query.error?.status === 400) return <NotFoundPage what="campaign" />;
  if (query.error) {
    return (
      <div className="container-page py-16">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  const brand = campaign.brand;
  const skills = campaign.requiredSkills ?? [];
  const tools = campaign.requiredTools ?? [];

  return (
    <article className="pb-24">
      <div className="container-page pt-8">
        <Link to="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-ink">
          <ArrowLeft className="size-4" /> All campaigns
        </Link>
      </div>

      <header className="container-page pb-12 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">
            {brand?.companyName} · {campaign.category}
          </p>
          {brand?.isDemo && <DemoBadge label="Demo brand" />}
          {campaign.status !== 'open' && <StatusPill status={campaign.status} />}
        </div>
        <h1 className="mt-4 max-w-4xl text-[30px] sm:text-[44px]">{campaign.title}</h1>
        <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-line/80 py-6 sm:grid-cols-4">
          <div>
            <dt className="eyebrow">Budget</dt>
            <dd className="mt-1.5 font-bold tabular-nums text-[15px]">{formatBudget(campaign.budgetMin, campaign.budgetMax)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Deadline</dt>
            <dd className="mt-1.5 text-[15px]">{campaign.deadline ? formatDate(campaign.deadline) : 'Flexible'}</dd>
          </div>
          <div>
            <dt className="eyebrow">Timing</dt>
            <dd className="mt-1.5 inline-flex items-center gap-1.5 text-[15px]">
              <CalendarDays className="size-4 text-steel" strokeWidth={1.75} /> {relativeDeadline(campaign.deadline)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Posted</dt>
            <dd className="mt-1.5 text-[15px]">{formatDate(campaign.createdAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="container-page grid gap-12 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-8">
          <section>
            <h2 className="eyebrow mb-4">The brief</h2>
            <p className="whitespace-pre-line text-[16px] font-medium leading-relaxed text-ink sm:text-[17px]">{campaign.brief}</p>
          </section>

          {campaign.deliverables?.length > 0 && (
            <section>
              <h2 className="eyebrow mb-4">Deliverables</h2>
              <ol className="border-t border-line/80">
                {campaign.deliverables.map((d, i) => (
                  <li key={`${d.title}-${i}`} className="grid grid-cols-[2.5rem_1fr_auto] gap-3 border-b border-line/80 py-5">
                    <span className="font-mono text-xs text-steel">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="font-semibold">{d.title}</p>
                      {d.description && <p className="mt-1 text-[15px] text-steel">{d.description}</p>}
                    </div>
                    <span className="text-sm font-bold tabular-nums">×{d.quantity ?? 1}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(skills.length > 0 || tools.length > 0) && (
            <section className="grid gap-8 sm:grid-cols-2">
              {skills.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-3">Skills needed</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {tools.length > 0 && (
                <div>
                  <h2 className="eyebrow mb-3">Preferred tools</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-lg border border-line/80 bg-white p-6 lg:sticky lg:top-24">
            <ApplyPanel campaign={campaign} viewer={viewer} user={user} onApply={onApply} roleNotice={roleNotice} />
            {brand && (
              <div className="mt-6 border-t border-line/60 pt-6">
                <p className="eyebrow">About the brand</p>
                <p className="mt-2 font-extrabold tracking-[-0.03em] text-xl">{brand.companyName}</p>
                {brand.industry && <p className="text-[13px] text-steel">{brand.industry}</p>}
                {brand.description && <p className="mt-3 text-[14px] leading-relaxed text-ink/80">{brand.description}</p>}
                {brand.websiteUrl && !brand.isDemo && (
                  <a href={brand.websiteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-navy hover:underline">
                    <Globe className="size-3.5" /> Website
                  </a>
                )}
              </div>
            )}
            <Link to="/creators" className="mt-6 inline-flex items-center gap-1.5 border-t border-line/60 pt-4 text-[13px] text-steel hover:text-ink">
              <Users className="size-3.5" /> See who else creates in {campaign.category}
            </Link>
          </div>
        </aside>
      </div>

      {user?.role === 'creator' && <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} campaign={campaign} />}
    </article>
  );
}
