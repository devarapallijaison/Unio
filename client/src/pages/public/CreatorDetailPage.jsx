import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, MapPin, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AvailabilityLabel } from '../../components/creators/CreatorCard.jsx';
import { InviteDialog } from '../../components/invitations/InviteDialog.jsx';
import { PortfolioGrid } from '../../components/portfolio/PortfolioGrid.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { DemoBadge, StatusPill, Tag } from '../../components/ui/Badge.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatINR } from '../../lib/format.js';
import { authLink } from '../../lib/returnTo.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from './NotFoundPage.jsx';

function TagBlock({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="eyebrow mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => (
          <Tag key={s}>{s}</Tag>
        ))}
      </div>
    </div>
  );
}

export default function CreatorDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleNotice, setRoleNotice] = useState(false);

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

  const { portfolio, viewer } = query.data;
  const invitations = viewer?.invitations ?? [];
  const activeInvites = invitations.filter((i) => ['pending', 'accepted'].includes(i.status));

  return (
    <article>
      <div className="container-page pt-8">
        <Link to="/creators" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> All creators
        </Link>
      </div>

      <header className="container-page grid gap-10 pb-14 pt-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={creator.displayName} src={creator.photoUrl} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {creator.isDemo && <DemoBadge />}
                <AvailabilityLabel value={creator.availability} />
              </div>
              <h1 className="mt-3 text-5xl leading-[1] sm:text-6xl">{creator.displayName}</h1>
              {creator.location && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-muted">
                  <MapPin className="size-4" strokeWidth={1.75} /> {creator.location}
                </p>
              )}
            </div>
          </div>
          {creator.bio && <p className="mt-8 max-w-2xl font-display text-xl font-[350] leading-relaxed text-ink/90 sm:text-[22px]">{creator.bio}</p>}
          {creator.isDemo && (
            <p className="mt-5 max-w-2xl text-[13px] text-muted">
              This is a fictional demo profile. Its portfolio pieces illustrate the format and are not real client work.
            </p>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="rounded-lg border border-beige/80 bg-white p-6 lg:sticky lg:top-24">
            <p className="eyebrow">Starting from</p>
            <p className="mt-1 font-display text-4xl">{creator.startingPrice != null ? formatINR(creator.startingPrice) : 'On request'}</p>
            <div className="mt-6 space-y-5 border-t border-beige/60 pt-6">
              <TagBlock label="Skills" items={creator.skills} />
              <TagBlock label="Tools" items={creator.tools} />
              <TagBlock label="Specialties" items={creator.specialties} />
            </div>

            {viewer?.isSelf ? (
              <ButtonLink to="/creator/profile/edit" variant="secondary" className="mt-6 w-full">
                Edit your profile
              </ButtonLink>
            ) : (
              <Button className="mt-6 w-full" size="lg" onClick={onInvite} disabled={creator.availability === 'unavailable'}>
                <Send className="size-4" /> Invite to campaign
              </Button>
            )}
            {creator.availability === 'unavailable' && !viewer?.isSelf && (
              <p className="mt-2 text-center text-[13px] text-muted">This creator isn’t taking new work right now.</p>
            )}
            {!user && <p className="mt-2 text-center text-[13px] text-muted">You’ll be asked to sign in with a brand account.</p>}
            {roleNotice && user?.role === 'creator' && !viewer?.isSelf && (
              <Alert tone="info" className="mt-4">
                Invitations are sent by brand accounts. You’re signed in as a creator — browse{' '}
                <Link to="/campaigns" className="underline">open campaigns</Link> to apply instead.
              </Alert>
            )}
            {activeInvites.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-beige/60 pt-4">
                <p className="eyebrow">Your invitations</p>
                {activeInvites.map((i) => (
                  <div key={i._id} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-muted">{i.campaignTitle}</span>
                    <StatusPill status={i.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </header>

      <section className="border-t border-beige/80 bg-sand/40">
        <div className="container-page py-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="font-mono text-xs text-muted">Portfolio</p>
              <h2 className="mt-2 text-4xl">Selected work</h2>
            </div>
            <p className="font-mono text-xs text-muted">{String(portfolio.length).padStart(2, '0')} pieces</p>
          </div>
          {portfolio.length ? (
            <PortfolioGrid items={portfolio} />
          ) : (
            <EmptyState icon={ImageOff} title="No portfolio pieces yet">
              {creator.displayName} hasn’t published work samples. You can still invite them and discuss references directly.
            </EmptyState>
          )}
        </div>
      </section>

      {user?.role === 'brand' && (
        <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} creator={creator} existingInvitations={invitations} />
      )}
    </article>
  );
}
