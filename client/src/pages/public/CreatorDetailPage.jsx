import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ImageOff, Paperclip, Pencil, Send, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AvailabilityDot, categoryLabel, formatDuration } from '../../components/creators/CreatorCard.jsx';
import { InviteDialog } from '../../components/invitations/InviteDialog.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { DemoBadge, StatusPill } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Segmented } from '../../components/ui/Form.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { MadeOnUnio, ToolChain, ToolChip, TrustLadder, toolState } from '../../components/ui/Trust.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatDate, formatINR, pluralize } from '../../lib/format.js';
import { authLink } from '../../lib/returnTo.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from './NotFoundPage.jsx';

/* v9 P3 — creator profile. Every number here comes from real records (pieces, completed projects, feedback). */

const LEVEL_NAMES = ['Self-reported', 'Pending review', 'Certified', 'Verified', '★ Made on UNIO'];

const pieceHref = (creatorId, pieceId) => `/creators/${creatorId}/work/${pieceId}`;

function pieceMeta(p) {
  return [
    p.generations ? `${p.generations} generations` : null,
    p.versionsCount ? pluralize(p.versionsCount, 'version') : null,
    p.madeOnUnio ? '★ Made on UNIO' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function FeaturedWork({ creator, portfolio }) {
  const [filter, setFilter] = useState('all');
  const items = portfolio.filter((p) => filter === 'all' || (filter === 'video' ? p.mediaType === 'video' : p.mediaType !== 'video'));
  const verified = (tool) => creator.verifiedTools.some((t) => t.toLowerCase() === tool.toLowerCase());
  return (
    <section id="work" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px]">Featured work</h2>
        <Segmented
          label="Filter work"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'video', label: 'Video' },
            { value: 'stills', label: 'Stills' },
          ]}
        />
      </div>
      {items.length === 0 ? (
        <EmptyState icon={ImageOff} title={portfolio.length ? 'Nothing in this filter' : 'No portfolio pieces yet'}>
          {portfolio.length ? 'Try another filter.' : `${creator.displayName} hasn’t published work samples yet.`}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr]">
          {items.map((p, i) => {
            const big = i === 0;
            const steps = (p.workflow ?? []).map((s) => ({ name: s.tool, verified: verified(s.tool) }));
            const meta = pieceMeta(p);
            return (
              <Link
                key={p._id}
                to={pieceHref(creator._id, p._id)}
                className={`group flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-card ${big ? 'sm:col-span-2 lg:col-span-1 lg:row-span-2' : ''}`}
              >
                <div className="relative flex-1">
                  <MediaFrame
                    item={p}
                    aspect={big ? 'aspect-[4/5] lg:aspect-auto lg:h-full lg:min-h-[360px]' : 'aspect-[16/10]'}
                    className="rounded-none"
                    showLabel={false}
                  />
                  {p.mediaType === 'video' && formatDuration(p.durationSec) && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-full bg-ink/60 px-2 py-0.5 font-mono text-[11px] text-white">▶ {formatDuration(p.durationSec)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 px-3.5 py-3">
                  <b className="text-[14px] group-hover:underline">{p.title}</b>
                  {big && steps.length > 0 ? (
                    <ToolChain steps={steps} />
                  ) : steps.length > 0 ? (
                    <span className="text-[12.5px] text-steel">{steps.map((s) => s.name).join(' → ')}</span>
                  ) : p.tools?.length ? (
                    <span className="text-[12.5px] text-steel">{p.tools.join(' · ')}</span>
                  ) : null}
                  {meta && <span className="text-[12.5px] text-steel">{meta}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Proof line for a tool, from real review records: challenge code, date and expiry. */
function proofLine(t) {
  const until = t.expiresAt ? ` · expires ${formatDate(t.expiresAt, { month: 'short', year: 'numeric' })}` : '';
  if (t.status === 'VERIFIED') {
    const when = t.reviewedAt ? ` · ${formatDate(t.reviewedAt)}` : '';
    return t.code ? `Challenge ${t.code}${when}${until}` : `Verified by a UNIO reviewer${when}${until}`;
  }
  if (t.status === 'CERTIFIED') return `Certificate checked${t.issuer ? ` · ${t.issuer}` : ''}${until}`;
  if (t.status === 'PENDING') return 'Evidence sent · review pending';
  return 'Self-reported';
}

function ToolsCard({ tools }) {
  return (
    <Card pad id="tools" className="scroll-mt-24">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[17px]">Tools</h3>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-steel">
          <span className="grid h-5 w-6 place-items-center rounded-[6px] bg-navy text-ok-ln">
            <Check className="size-3" strokeWidth={2.4} />
          </span>
          Verified
          <span className="grid h-5 w-6 place-items-center rounded-[6px] border border-navy text-navy">
            <Paperclip className="size-3" />
          </span>
          Certificate
          <span className="grid h-5 w-6 place-items-center rounded-[6px] border border-line2">·</span>
          Self-reported
        </div>
      </div>
      {tools.length ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {tools.map((t) => (
            <div key={t.name} className="flex flex-wrap items-center gap-2.5 rounded-md border border-[#edf0ef] bg-soft px-3 py-2.5">
              <ToolChip name={t.name} state={toolState(t.status)} />
              <span className="text-[12.5px] text-steel">{proofLine(t)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-steel">No tools listed yet.</p>
      )}
    </Card>
  );
}

function SkillsCard({ creator, taxonomy }) {
  return (
    <Card pad>
      <h3 className="mb-3 text-[17px]">Skills, backed by work</h3>
      {creator.backedSkills.length ? (
        creator.backedSkills.map((s) => (
          <div key={s.id} className="flex items-center justify-between border-b border-[#edf0ef] py-2.5 last:border-0">
            <span>{labelOf(taxonomy, 'skills', s.id)}</span>
            <a href="#work" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
              {pluralize(s.pieces, 'piece')} <ArrowRight className="size-3" />
            </a>
          </div>
        ))
      ) : (
        <p className="text-[13px] text-steel">No skills are backed by a portfolio piece yet. Skills show here once a piece proves them.</p>
      )}
    </Card>
  );
}

function TrustCard({ creator }) {
  const facts = [
    creator.madeOnUnioCount ? `${pluralize(creator.madeOnUnioCount, 'project')} delivered here.` : 'No projects completed on UNIO yet.',
    creator.verifiedTools.length
      ? `${pluralize(creator.verifiedTools.length, 'tool')} verified by a UNIO reviewer.`
      : 'No tools verified yet.',
    creator.pendingTools.length ? `${pluralize(creator.pendingTools.length, 'tool')} waiting for review.` : null,
  ].filter(Boolean);
  return (
    <Card dark pad>
      <span className="eyebrow text-mist">UNIO Trust</span>
      <h3 className="mb-3 mt-1.5 text-[22px] text-white">{LEVEL_NAMES[(creator.trustLevel ?? 1) - 1]}</h3>
      <p className="text-[12.5px] text-bone">{facts.join(' ')}</p>
      <TrustLadder level={creator.trustLevel ?? 1} dark className="mt-3.5" />
    </Card>
  );
}

function Reviews({ feedback, creator }) {
  return (
    <Card pad id="reviews" className="scroll-mt-24">
      <div className="flex items-center justify-between">
        <h3 className="text-[17px]">Reviews</h3>
        {creator.ratingCount > 0 && (
          <b className="tabular-nums">
            {creator.ratingAvg}★ · {creator.ratingCount}
          </b>
        )}
      </div>
      {feedback.length ? (
        feedback.map((f, i) => (
          <div key={i} className="mt-3.5 flex gap-3 rounded-md bg-soft p-3.5">
            <Avatar name={f.brandName} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <b>{f.brandName}</b>
                <span className="text-[12.5px] text-steel">
                  {f.campaignTitle ? `· ${f.campaignTitle} ` : ''}· {formatDate(f.createdAt, { month: 'short', year: 'numeric' })}
                </span>
                <span className="ml-1 inline-flex text-navy" aria-label={`${f.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, n) => (
                    <Star key={n} className={`size-3 ${n < f.rating ? 'fill-current' : 'text-line2'}`} />
                  ))}
                </span>
              </div>
              {f.comment && <p className="mt-1.5 text-slate">“{f.comment}”</p>}
            </div>
          </div>
        ))
      ) : (
        <p className="mt-2 text-[13px] text-steel">No reviews yet. Reviews come only from brands on completed UNIO projects.</p>
      )}
    </Card>
  );
}

export default function CreatorDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleNotice, setRoleNotice] = useState(false);
  const [tab, setTab] = useState('work');

  const query = useQuery({ queryKey: ['pub', 'creator', id, user?._id ?? 'guest'], queryFn: () => endpoints.creators.get(id) });
  const creator = query.data?.creator;
  useDocumentTitle(creator?.displayName ?? 'Creator');

  // Resume the invite flow after sign-in. Opens the form for review; never sends automatically.
  useEffect(() => {
    if (params.get('intent') !== 'invite' || !creator || !user) return;
    if (user.role === 'brand') setInviteOpen(true);
    else setRoleNotice(true);
    setParams((p) => {
      p.delete('intent');
      return p;
    }, { replace: true });
  }, [params, creator, user, setParams]);

  const banner = useMemo(() => (query.data?.portfolio ?? []).find((p) => p.mediaType !== 'video') ?? query.data?.portfolio?.[0], [query.data]);

  const onInvite = () => {
    if (!user) return navigate(authLink('login', `/creators/${id}?intent=invite`));
    if (user.role !== 'brand') return setRoleNotice(true);
    setInviteOpen(true);
  };

  if (query.isLoading) return <PageLoader label="Loading profile" />;
  if (query.error?.status === 404 || query.error?.status === 400) return <NotFoundPage what="creator" />;
  if (query.error) {
    return (
      <div className="container-page py-16">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  const { portfolio, viewer, signals } = query.data;
  const invitations = viewer?.invitations ?? [];
  const activeInvites = invitations.filter((i) => ['pending', 'accepted'].includes(i.status));
  const feedback = signals?.feedback ?? [];
  const type = categoryLabel(taxonomy, creator.category);
  const facts = [
    ['Starting at', creator.startingPrice != null ? `${formatINR(creator.startingPrice)} / piece` : 'On request'],
    ['Turnaround', creator.turnaroundDays ? pluralize(creator.turnaroundDays, 'day') : null],
    ['Languages', creator.languages.length ? creator.languages.join(', ') : null],
    ['Revisions', creator.revisionsIncluded != null ? `${creator.revisionsIncluded} included` : null],
  ].filter(([, v]) => v);
  const tabs = [
    ['work', `Work · ${portfolio.length}`],
    creator.howIWork.length ? ['how', 'How I work'] : null,
    ['tools', 'Tools & trust'],
    ['reviews', `Reviews · ${feedback.length}`],
  ].filter(Boolean);

  return (
    <article>
      <div className="relative h-[180px] overflow-hidden bg-navy md:h-[240px]">
        {banner && <MediaFrame item={banner} aspect="aspect-auto" className="absolute inset-0 h-full rounded-none opacity-90" showLabel={false} hover={false} />}
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(6,20,27,.55))]" />
      </div>

      <div className="container-page grid gap-8 pb-16 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="relative z-10 -mt-[90px] flex flex-col gap-4 self-start rounded-lg border border-line bg-white p-[22px] shadow-card lg:sticky lg:top-[84px]">
          <Avatar name={creator.displayName} src={creator.photoUrl} size="xl" className="-mt-[70px]" />
          <div>
            <h1 className="text-[30px]">{creator.displayName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-steel">
              {[type, creator.location].filter(Boolean).join(' · ')}
              {(type || creator.location) && ' ·'}
              <AvailabilityDot value={creator.availability} />
            </p>
          </div>
          {(creator.madeOnUnioCount > 0 || creator.isDemo) && (
            <div className="flex flex-wrap gap-1.5">
              {creator.madeOnUnioCount > 0 && <MadeOnUnio count={creator.madeOnUnioCount} />}
              {creator.isDemo && <DemoBadge />}
            </div>
          )}
          <TrustLadder level={creator.trustLevel ?? 1} />
          <div className="grid grid-cols-3 rounded-md border border-line text-center">
            <div className="flex flex-col items-center p-2.5">
              <b className="text-[18px]">{creator.ratingCount > 0 ? `${creator.ratingAvg}★` : '—'}</b>
              <span className="text-[11.5px] text-steel">{creator.ratingCount > 0 ? pluralize(creator.ratingCount, 'review') : 'no reviews yet'}</span>
            </div>
            <div className="flex flex-col items-center border-l border-line p-2.5">
              <b className="text-[18px]">{creator.madeOnUnioCount}</b>
              <span className="text-[11.5px] text-steel">projects</span>
            </div>
            <div className="flex flex-col items-center border-l border-line p-2.5">
              <b className="text-[18px]">{portfolio.length}</b>
              <span className="text-[11.5px] text-steel">pieces</span>
            </div>
          </div>
          {viewer?.isSelf ? (
            <ButtonLink to="/creator/profile/edit" className="w-full">
              <Pencil className="size-4" /> Edit your profile
            </ButtonLink>
          ) : (
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={onInvite} disabled={creator.availability === 'unavailable'}>
                <Send className="size-4" /> Invite to a brief
              </Button>
              {creator.availability === 'unavailable' && <p className="text-center text-[12.5px] text-steel">Not taking new work right now.</p>}
              {!user && <p className="text-center text-[12.5px] text-steel">You’ll be asked to sign in with a brand account.</p>}
            </div>
          )}
          {roleNotice && user?.role === 'creator' && !viewer?.isSelf && (
            <Alert tone="info">
              Invitations are sent by brand accounts. You’re signed in as a creator — browse{' '}
              <Link to="/campaigns" className="underline">open campaigns</Link> to apply instead.
            </Alert>
          )}
          {activeInvites.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Your invitations</p>
              {activeInvites.map((i) => (
                <div key={i._id} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="truncate text-steel">{i.campaignTitle}</span>
                  <StatusPill status={i.status} />
                </div>
              ))}
            </div>
          )}
          <hr className="border-line" />
          <dl className="flex flex-col gap-2 text-[12.5px]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-steel">{k}</dt>
                <dd className="text-right font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <nav aria-label="Profile sections" className="flex gap-[26px] overflow-x-auto border-b border-line pt-[22px] font-semibold text-steel">
            {tabs.map(([key, label]) => (
              <a
                key={key}
                href={`#${key}`}
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'true' : undefined}
                className={`whitespace-nowrap pb-3 ${tab === key ? 'text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'hover:text-ink'}`}
              >
                {label}
              </a>
            ))}
          </nav>

          {(creator.bio || creator.headline) && (
            <div>
              <p className="max-w-[760px] text-[17px] leading-[1.55] tracking-[-0.01em] text-slate md:text-[19px]">{creator.bio || creator.headline}</p>
              {creator.isDemo && (
                <p className="mt-2 text-[12.5px] text-steel">Fictional demo profile — its pieces illustrate the format and are not real client work.</p>
              )}
            </div>
          )}

          <ToolsCard tools={signals?.tools ?? []} />
          <FeaturedWork creator={creator} portfolio={portfolio} />

          {creator.howIWork.length > 0 && (
            <Card pad id="how" className="scroll-mt-24">
              <h3 className="mb-4 text-[17px]">How I work</h3>
              <ol className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
                {creator.howIWork.map((s, i) => (
                  <li key={s.title} className="flex flex-col gap-1 rounded-md border border-[#edf0ef] bg-soft p-3.5">
                    <span className="mb-1.5 grid size-[26px] place-items-center rounded-full bg-navy text-[12px] font-bold text-white">{i + 1}</span>
                    <b>{s.title}</b>
                    {s.detail && <small className="text-[12px] leading-snug text-steel">{s.detail}</small>}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <div className="grid gap-[18px] md:grid-cols-2">
            <SkillsCard creator={creator} taxonomy={taxonomy} />
            <TrustCard creator={creator} />
          </div>

          <Reviews feedback={feedback} creator={creator} />
        </div>
      </div>

      {user?.role === 'brand' && (
        <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} creator={creator} existingInvitations={invitations} />
      )}
    </article>
  );
}
