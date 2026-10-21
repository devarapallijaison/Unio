import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, Lock, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Alert, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, Textarea } from '../../components/ui/Form.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
import { isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { embedUrl, isVideoFile } from '../../lib/embed.js';
import { formatDate } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/**
 * v9 A3 — the client's approval page. No login: the link is the credential. Kept deliberately small:
 * the version, what changed, and one decision. The answer goes to the agency as advice; the agency decides.
 */

const IMAGE = /\.(jpe?g|png|webp|gif)(\?|$)/i;

function Media({ url, poster }) {
  const embed = !isPlaceholderUrl(url) && embedUrl(url);
  if (isPlaceholderUrl(url)) {
    return <div className="grid aspect-[9/16] max-h-[78vh] w-full place-items-center bg-ink p-6 text-center text-[14px] text-bone">This is a demo placeholder, so there is no file to play.</div>;
  }
  if (embed) return <iframe title="Version" src={embed} allow="fullscreen" referrerPolicy="no-referrer" className="aspect-video w-full bg-black" />;
  if (isVideoFile(url)) return <video src={url} poster={poster ?? undefined} controls playsInline preload="metadata" className="max-h-[78vh] w-full bg-black" />;
  if (IMAGE.test(url)) return <img src={url} alt="Version to approve" referrerPolicy="no-referrer" className="max-h-[78vh] w-full object-contain bg-ink" />;
  return (
    <div className="grid aspect-video w-full place-items-center bg-ink p-6 text-center">
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-bone px-5 py-2.5 text-[14px] font-semibold text-ink">
        <ExternalLink className="size-4" /> Open the file
      </a>
    </div>
  );
}

function Shell({ agency, children }) {
  return (
    <div className="min-h-dvh bg-page">
      <header className="bg-ink">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <div className="flex items-center gap-3.5">
            <Logo onDark className="h-6" />
            <span className="hidden text-[13px] text-mist sm:block">Approval link · no login needed</span>
          </div>
          {agency && <span className="truncate text-[13px] text-mist">Sent by {agency}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-[1160px] px-4 pb-16 pt-8 sm:px-8 sm:pt-10">{children}</main>
    </div>
  );
}

function Message({ title, children }) {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <h1 className="text-[30px] sm:text-[36px]">{title}</h1>
      <p className="mt-3 text-[16px] text-steel">{children}</p>
    </div>
  );
}

export default function ClientApprovalPage() {
  const { token } = useParams();
  useDocumentTitle('Approve a version');
  // The link is a secret: never send it on as a referrer, never index it.
  useEffect(() => {
    const tags = [
      ['referrer', 'no-referrer'],
      ['robots', 'noindex, nofollow'],
    ].map(([name, content]) => {
      const m = document.createElement('meta');
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      return m;
    });
    return () => tags.forEach((m) => m.remove());
  }, []);

  const query = useQuery({ queryKey: ['approval', token], queryFn: () => endpoints.approval.get(token), retry: false, refetchOnWindowFocus: false });
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [noteError, setNoteError] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => endpoints.approval.decide(token, { decision, ...(note.trim() ? { note: note.trim() } : {}), ...(name.trim() ? { approverName: name.trim() } : {}) }),
    onSuccess: () => query.refetch(),
  });

  if (query.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-96" />
      </Shell>
    );
  }
  if (query.error) {
    const notFound = query.error.status === 404 || query.error.status === 400;
    return (
      <Shell>
        <Message title={notFound ? 'This link is not valid' : 'We could not open this link'}>
          {notFound ? 'It may have been mistyped. Ask your agency to send it again.' : 'Check your connection and try again.'}
          {!notFound && (
            <>
              <br />
              <Button className="mt-5" onClick={() => query.refetch()}>
                Try again
              </Button>
            </>
          )}
        </Message>
      </Shell>
    );
  }

  const d = query.data;
  const agency = d.agencyName;
  if (d.state === 'used') {
    const approved = d.decision === 'approved';
    return (
      <Shell agency={agency}>
        <Message title={approved ? 'Thank you. You approved it.' : 'Thank you. Your changes are noted.'}>
          Your answer for {d.projectTitle} was recorded. {agency ?? 'Your agency'} will take it from here{approved ? ' and confirm the hand-off' : ' and pass your note to the creator'}.
          <br />
          This link has been used, so you can close this page.
        </Message>
      </Shell>
    );
  }
  if (d.state === 'expired') {
    return (
      <Shell agency={agency}>
        <Message title="This link has expired">Approval links last 7 days. Ask {agency ?? 'your agency'} for a new one.</Message>
      </Shell>
    );
  }
  if (d.state === 'closed') {
    return (
      <Shell agency={agency}>
        <Message title="Your agency has already decided">There is nothing left for you to do on this version. Thank you.</Message>
      </Shell>
    );
  }

  const v = d.version;
  const requestChanges = () => {
    if (note.trim().length < 10) return setNoteError('Say what should change (at least 10 characters).');
    setNoteError('');
    decide.mutate('changes');
  };
  const forLine = [d.approverName ? `For ${d.approverName}` : 'For you', d.clientName].filter(Boolean).join(' · ');

  return (
    <Shell agency={agency}>
      <p className="eyebrow">{forLine}</p>
      <h1 className="mt-2 text-[30px] sm:text-[36px]">
        {d.projectTitle} — v{v.number} is ready for you
      </h1>
      <p className="mt-2 max-w-2xl text-[16px] text-steel">
        {d.creatorName ? `Made by ${d.creatorName}. ` : ''}
        {agency ?? 'Your agency'} shared this version with you. Approve it or ask for changes.
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl bg-ink">
          <Media url={v.mediaUrl} poster={v.thumbnailUrl} />
          <div className="flex items-center justify-between px-4 py-2.5 font-mono text-[12px] text-mist">
            <span>{d.deliverableTitle}</span>
            <span>v{v.number}</span>
          </div>
        </div>

        <div className="space-y-4">
          <Card pad className="space-y-2.5">
            <p className="eyebrow">{v.number > 1 ? `What changed since v${v.number - 1}` : 'What this is'}</p>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{v.changeNote}</p>
            {v.toolsUsed?.length > 0 && <p className="text-[13px] text-steel">Made with {v.toolsUsed.join(', ')}</p>}
          </Card>

          <Card pad className="space-y-3.5">
            <b className="block text-[16px]">Your decision</b>
            <Button variant="success" size="lg" className="w-full" onClick={() => decide.mutate('approve')} loading={decide.isPending && decide.variables === 'approve'}>
              <Check className="size-4" /> Approve v{v.number}
            </Button>
            <Textarea
              label="Or ask for changes"
              hint="A note of at least 10 characters is required"
              rows={3}
              maxLength={2000}
              placeholder="What should change?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={noteError}
            />
            <Button variant="danger" size="lg" className="w-full" onClick={requestChanges} loading={decide.isPending && decide.variables === 'changes'}>
              <RotateCcw className="size-4" /> Request changes
            </Button>
            <Input label="Your name" note="Optional" value={name} onChange={(e) => setName(e.target.value)} placeholder={d.approverName ?? 'So your agency knows who answered'} maxLength={120} />
            {decide.error && (
              <Alert tone="error">
                {decide.error.message}
                {['LINK_USED', 'LINK_EXPIRED', 'LINK_CLOSED'].includes(decide.error.code) && (
                  <button type="button" onClick={() => query.refetch()} className="ml-1.5 font-semibold underline">
                    Refresh
                  </button>
                )}
              </Alert>
            )}
          </Card>
          <p className="flex items-start gap-1.5 text-[13px] text-steel">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Your answer goes to {agency ?? 'your agency'}, who confirms it. This link works once and ends {formatDate(d.expiresAt)}.
          </p>
        </div>
      </div>
    </Shell>
  );
}
