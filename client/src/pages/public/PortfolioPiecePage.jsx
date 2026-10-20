import { useQuery } from '@tanstack/react-query';
import { Check, Info, Lock, Play, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { DemoBadge, Pill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Segmented } from '../../components/ui/Form.jsx';
import { MediaFrame, isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { MadeOnUnio } from '../../components/ui/Trust.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatDate, pluralize } from '../../lib/format.js';
import { authLink } from '../../lib/returnTo.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from './NotFoundPage.jsx';

/* v9 P3W — one portfolio piece and how it was made. Facts that don't exist are hidden, never invented. */

/** YouTube / Vimeo links play in an iframe (CSP frame-src allows these hosts). */
export function embedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

const ASPECT = { '9:16': 'aspect-[9/16]', '16:9': 'aspect-video', '1:1': 'aspect-square', '4:5': 'aspect-[4/5]' };

function Player({ media, format }) {
  const aspect = ASPECT[format] ?? (media.mediaType === 'video' ? 'aspect-[9/16]' : 'aspect-[4/5]');
  const embed = embedUrl(media.mediaUrl);
  const real = media.mediaUrl && !isPlaceholderUrl(media.mediaUrl);
  return (
    <div className={`relative overflow-hidden rounded-lg bg-ink ${aspect}`}>
      {embed ? (
        <iframe src={embed} title={media.title ?? 'Portfolio piece'} className="absolute inset-0 size-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : media.mediaType === 'video' && real ? (
        <video src={media.mediaUrl} poster={media.thumbnailUrl && !isPlaceholderUrl(media.thumbnailUrl) ? media.thumbnailUrl : undefined} controls playsInline className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <MediaFrame item={media} aspect="aspect-auto" className="absolute inset-0 h-full rounded-none" hover={false} />
          {media.mediaType === 'video' && (
            <span className="absolute inset-0 m-auto grid size-[60px] place-items-center rounded-full bg-page/90 text-ink" aria-hidden>
              <Play className="ml-1 size-[22px] fill-current" />
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Facts({ piece, taxonomy }) {
  const facts = [
    ['Type', piece.contentType ? labelOf(taxonomy, 'contentTypes', piece.contentType) : null],
    ['Format', [piece.format, piece.durationSec ? `${piece.durationSec} s` : null].filter(Boolean).join(' · ') || null],
    ['Generations', piece.generations ?? null],
    ['Versions', piece.versionsCount ?? null],
    ['Time', piece.timeTakenDays != null ? pluralize(piece.timeTakenDays, 'day') : null],
    ['Industry', piece.industry ? labelOf(taxonomy, 'specializations', piece.industry) : null],
  ].filter(([, v]) => v != null && v !== '');
  if (!facts.length) return null;
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-white sm:grid-cols-3">
      {facts.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 border-b border-r border-[#edf0ef] px-3.5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-steel">{k}</span>
          <b className="text-[16px]">{v}</b>
        </div>
      ))}
    </div>
  );
}

function HowItWasMade({ steps }) {
  if (!steps.length) return null;
  return (
    <Card pad>
      <h3 className="mb-3.5 text-[16px]">How it was made</h3>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={`${s.tool}-${i}`} className="relative flex gap-3.5 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[11px] top-6 border-l-2 border-line" />}
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${s.verified ? 'border-ok bg-ok text-white' : 'border-line2 bg-white'}`}
              title={s.verified ? 'Verified by UNIO' : 'Self-reported'}
            >
              {s.verified && <Check className="size-3" strokeWidth={2.6} aria-label="verified" />}
            </span>
            <div className="min-w-0">
              <b>{s.tool}</b>{' '}
              <span className="font-mono text-[12px] text-steel">{[s.version, s.generations ? `${s.generations} gens` : null].filter(Boolean).join(' · ')}</span>
              {s.note && <p className="text-[12.5px] text-steel">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function PortfolioPiecePage() {
  const { id, itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: taxonomy } = useTaxonomy();
  const [version, setVersion] = useState(null);
  const query = useQuery({ queryKey: ['pub', 'piece', itemId], queryFn: () => endpoints.portfolio.get(itemId) });
  const piece = query.data?.piece;
  useDocumentTitle(piece?.title ?? 'Portfolio piece');

  if (query.isLoading) return <PageLoader label="Loading piece" />;
  if (query.error?.status === 404 || query.error?.status === 400 || (piece && String(query.data.creator._id) !== id)) {
    return <NotFoundPage what="piece" />;
  }
  if (query.error) {
    return (
      <div className="container-page py-16">
        <ErrorState error={query.error} onRetry={query.refetch} />
      </div>
    );
  }

  const { creator } = query.data;
  const versions = piece.versions ?? [];
  const last = versions.length - 1;
  // The piece's own media is the final version; earlier versions play their own media when shared.
  const current = version != null && version !== last && versions[version]?.mediaUrl ? { ...piece, ...versions[version], title: piece.title } : piece;
  const briefHref = `/brand/campaigns/new?from=${piece._id}`;
  const startBrief = () => navigate(user ? briefHref : authLink('login', briefHref));

  return (
    <div className="container-page pb-14 pt-[22px]">
      <nav aria-label="Breadcrumb" className="mb-3.5 text-[12.5px] text-steel">
        <Link to="/creators" className="hover:text-ink">Discover</Link> / <Link to={`/creators/${creator._id}`} className="hover:text-ink">{creator.displayName}</Link> /{' '}
        <b className="text-ink">{piece.title}</b>
      </nav>

      <div className="grid items-start gap-9 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Player media={current} format={piece.format} />
          {versions.length > 0 && (
            <Segmented
              label="Version"
              value={version ?? last}
              onChange={(v) => setVersion(v === last ? null : v)}
              options={versions.map((v, i) => ({ value: i, label: i === last ? `${v.label} · final` : v.label }))}
            />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {(piece.madeOnUnio || creator.commerciallySafe || creator.isDemo) && (
              <div className="flex flex-wrap gap-1.5">
                {piece.madeOnUnio && <MadeOnUnio />}
                {creator.commerciallySafe && <Pill tone="ok">Commercially safe</Pill>}
                {creator.isDemo && <DemoBadge />}
              </div>
            )}
            <h1 className="text-[28px] md:text-[36px]">{piece.title}</h1>
            <div className="flex items-center gap-2">
              <Avatar name={creator.displayName} src={creator.photoUrl} size="sm" />
              <Link to={`/creators/${creator._id}`} className="font-bold hover:underline">
                {creator.displayName}
              </Link>
              <span className="text-[12.5px] text-steel">· added {formatDate(piece.createdAt)}</span>
            </div>
          </div>

          <Facts piece={piece} taxonomy={taxonomy} />
          <HowItWasMade steps={piece.workflow ?? []} />

          {(piece.briefSummary || piece.deliveredSummary) && (
            <Card pad>
              <h3 className="mb-2.5 text-[16px]">Brief vs delivered</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {piece.briefSummary && (
                  <div className="flex flex-col gap-1.5 rounded-md bg-soft p-3 text-[13.5px]">
                    <span className="eyebrow">Brief asked</span>
                    <p>{piece.briefSummary}</p>
                  </div>
                )}
                {piece.deliveredSummary && (
                  <div className="flex flex-col gap-1.5 rounded-md bg-ok-bg p-3 text-[13.5px]">
                    <span className="eyebrow !text-ok">Delivered</span>
                    <p>{piece.deliveredSummary}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {piece.licence?.licensedTo ? (
            <div className="flex gap-2 rounded-md border border-ok-ln bg-ok-bg px-3 py-2.5 text-[13px] text-ok">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>This piece was licensed to {piece.licence.licensedTo}.</b> {piece.licence.summary ? `${piece.licence.summary}. ` : ''}You can commission a
                similar piece — not reuse this one.
              </span>
            </div>
          ) : (
            piece.licence?.notForLicensing && (
              <div className="flex gap-2 rounded-md border border-line2 bg-soft px-3 py-2.5 text-[13px] text-navy">
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                  <b>Personal work — not for licensing.</b> You can commission a similar piece from {creator.displayName}.
                </span>
              </div>
            )
          )}

          {user?.role === 'creator' ? (
            <p className="rounded-md border border-line bg-white px-3 py-2.5 text-center text-[12.5px] text-steel">Brand accounts can start a brief from this piece.</p>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={startBrief}>
                <Sparkles className="size-4" /> I want something like this
              </Button>
              <span className="text-center text-[12.5px] text-steel">Opens a new brief pre-filled with this piece’s tools and a starting description.</span>
            </>
          )}
        </div>
      </div>

      {versions.length > 0 && (
        <Card className="mt-[22px]">
          <SectionHead title="Versions & feedback" action={<span className="text-[12.5px] text-steel">Shared by the creator</span>} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 px-5 py-[18px]">
            {versions.map((v, i) => (
              <button
                key={v.label}
                type="button"
                onClick={() => setVersion(i === last ? null : i)}
                className={`flex flex-col overflow-hidden rounded-md border bg-white text-left ${(version ?? last) === i ? 'border-navy shadow-[inset_0_0_0_2px_var(--color-navy)]' : 'border-line'}`}
              >
                <MediaFrame item={{ ...v, _id: `${piece._id}-${i}`, mediaType: piece.mediaType }} aspect="aspect-video" className="rounded-none" showLabel={false} hover={false} />
                <span className="flex flex-col gap-1 px-2.5 py-2 text-[12px]">
                  <span className="flex items-center justify-between gap-2">
                    <b>{v.label}</b>
                    {v.status && <Pill tone={v.status === 'approved' ? 'ok' : 'att'}>{v.status === 'approved' ? 'Approved' : 'Changes'}</Pill>}
                  </span>
                  {v.note && <span className="text-steel">{v.note}</span>}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
