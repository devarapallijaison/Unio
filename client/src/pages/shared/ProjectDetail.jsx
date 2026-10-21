import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleCheck, Clock3, ExternalLink, Info, Lock, Printer, RotateCcw, Star, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { MessagesPanel } from '../../components/projects/MessagesPanel.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Pill, StatusPill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, Textarea } from '../../components/ui/Form.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { RightsTicket } from '../../components/ui/Rights.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { formatDate, relativeDeadline } from '../../lib/format.js';
import { rightsRows } from '../../lib/rights.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from '../public/NotFoundPage.jsx';

/* v9 S1 (brand) / S2 (creator) project page and S3 final delivery with the rights card (F6, F7). */

const short = (d) => formatDate(d, { day: 'numeric', month: 'short' });
const latestOf = (d) => d.versions?.at(-1);
const isVideo = (url = '') => /\.(mp4|mov|webm)(\?|$)/i.test(url);

function headerPill(status, role) {
  const map = {
    not_started: ['neutral', role === 'creator' ? 'Start with v1' : 'Not started'],
    in_progress: ['info', 'In progress'],
    submitted: ['wait', role === 'brand' ? 'Review needed' : 'Waiting for the brand'],
    revision_requested: ['att', 'Changes requested'],
    completed: ['ok', 'Completed'],
    cancelled: ['neutral', 'Cancelled'],
  };
  const [tone, label] = map[status] ?? ['neutral', status];
  return <Pill tone={tone}>{label}</Pill>;
}

const STEPS = ['Hired', 'Making', 'Review', 'Changes', 'Delivered'];
function currentStep(status) {
  return { not_started: 1, in_progress: 1, submitted: 2, revision_requested: 3, completed: 5, cancelled: 1 }[status] ?? 1;
}

function Tracker({ status }) {
  const at = currentStep(status);
  return (
    <ol className="grid grid-cols-5 overflow-hidden rounded-b-lg border border-t-0 border-line bg-white">
      {STEPS.map((label, i) => {
        const done = i < at;
        const current = i === at && status !== 'completed';
        return (
          <li
            key={label}
            aria-current={current ? 'step' : undefined}
            className={`flex items-center gap-2 border-l border-line px-2 py-3 text-[13px] font-semibold first:border-l-0 sm:px-4 sm:text-[14px] ${current ? 'bg-wait-bg text-ink' : done ? 'text-ok' : 'text-slate'}`}
          >
            <span
              className={`grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-ok text-white' : current ? 'bg-wait text-white' : 'bg-line text-slate'}`}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className="hidden truncate sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ProjectHeader({ project, role }) {
  const counterpart = role === 'brand' ? project.creator?.displayName : project.brand?.companyName;
  const deadline = project.campaign?.deadline;
  return (
    <div className="rounded-t-lg bg-[linear-gradient(120deg,var(--color-ink),var(--color-navy)_60%,var(--color-slate))] px-5 py-6 text-white sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4 lg:flex-nowrap">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-mist">
            <Link to={role === 'brand' ? '/brand/projects' : '/creator/projects'} className="hover:text-white">
              Projects
            </Link>{' '}
            / {project.campaign?.title}
          </p>
          <h1 className="mt-1.5 text-[26px] text-white sm:text-[34px]">{project.campaign?.title}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-bone">
            {headerPill(project.status, role)}
            {deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" /> Due {short(deadline)} · {relativeDeadline(deadline)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw className="size-3.5" /> Revisions {project.revisionsUsed ?? 0} of {project.revisionsIncluded ?? 2} used
            </span>
            {project.rightsSummary && (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" /> {project.rightsSummary}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-[13px] text-bone">
          <span className="flex -space-x-2">
            <Avatar name={project.creator?.displayName ?? ''} src={project.creator?.photoUrl} size="md" className="ring-2 ring-navy" />
            <Avatar name={project.brand?.companyName ?? ''} size="md" className="ring-2 ring-navy" />
          </span>
          with {counterpart}
        </div>
      </div>
    </div>
  );
}

function versionLine(v, role) {
  if (v.status === 'approved') return `Approved · ${short(v.feedback?.at ?? v.submittedAt)}`;
  if (v.status === 'changes_requested') return `Changes requested · ${short(v.feedback?.at ?? v.submittedAt)}`;
  return role === 'brand' ? 'Waiting for you' : 'Waiting for the brand';
}

function Timeline({ deliverable, role }) {
  if (!deliverable.versions?.length) return <p className="text-[14px] text-steel">No versions yet.</p>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-line2">
      {deliverable.versions.map((v) => {
        const latest = v.number === deliverable.currentVersion;
        return (
          <li key={v.number} className="relative flex gap-3">
            <span
              className={`z-[1] grid h-[26px] w-9 shrink-0 place-items-center rounded-[6px] font-mono text-[11px] font-bold ${
                latest && v.status === 'submitted' ? 'bg-wait text-white' : v.status === 'approved' ? 'bg-ok text-white' : 'bg-line text-slate'
              }`}
            >
              v{v.number}
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-bold leading-snug">{v.changeNote}</p>
              <p className="text-[13px] text-steel">{versionLine(v, role)}</p>
              {v.feedback?.note && (
                <p className="mt-1 text-[13px] text-slate">
                  “{v.feedback.note}” — {v.feedback.byName}
                </p>
              )}
              <a href={v.mediaUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:underline">
                <ExternalLink className="size-3" /> Open v{v.number}
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function useProjectMutation(id, fn, onDone) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(['mine', 'project', id], data);
      qc.invalidateQueries({ queryKey: ['mine', 'projects'] });
      qc.invalidateQueries({ queryKey: ['mine', 'project-messages', id] });
      if (data.warning) toast.error(data.warning);
      onDone?.(data, toast);
    },
  });
}

function DecisionBox({ project, deliverable }) {
  const v = latestOf(deliverable);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const decide = useProjectMutation(project._id, (body) => endpoints.projects.decide(project._id, deliverable._id, v.number, body), (_d, toast) => {
    setNote('');
    toast.success('Decision sent.');
  });
  const left = (project.revisionsIncluded ?? 2) - (project.revisionsUsed ?? 0);
  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-md border border-line bg-soft/60 p-4">
        <div className="flex items-center gap-3">
          <Button variant="success" onClick={() => decide.mutate({ decision: 'approve' })} loading={decide.isPending && decide.variables?.decision === 'approve'}>
            <Check className="size-4" /> Approve v{v.number}
          </Button>
          <span className="text-[13px] text-steel">or</span>
        </div>
        <Textarea
          label="Request changes"
          hint="Required · at least 10 characters"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={noteError || (decide.error?.code === 'NOTE_REQUIRED' ? decide.error.message : undefined)}
          placeholder="e.g. Swap the end-card colour to our green"
        />
        <Button
          variant="danger"
          loading={decide.isPending && decide.variables?.decision === 'changes'}
          onClick={() => {
            if (note.trim().length < 10) return setNoteError('Explain what to change (at least 10 characters).');
            setNoteError('');
            decide.mutate({ decision: 'changes', note: note.trim() });
          }}
        >
          <RotateCcw className="size-4" /> Send changes
        </Button>
        {decide.error && decide.error.code !== 'NOTE_REQUIRED' && <Alert tone="error">{decide.error.message}</Alert>}
      </div>
      <p className="flex items-start gap-1.5 text-[13px] text-steel">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        {left > 0
          ? `${left} revision round${left > 1 ? 's' : ''} left. After that, extra rounds are agreed in messages.`
          : 'Revision rounds used up — agree extra rounds in messages.'}
      </p>
    </div>
  );
}

function SubmitVersionForm({ project, deliverables, initialId, tools }) {
  const options = deliverables.filter((d) => d.status !== 'approved' && latestOf(d)?.status !== 'submitted');
  const [id, setId] = useState(initialId ?? options[0]?._id);
  const [mediaUrl, setMediaUrl] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [used, setUsed] = useState([]);
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (initialId) setId(initialId);
  }, [initialId]);
  const d = deliverables.find((x) => x._id === id) ?? options[0];
  const next = (d?.currentVersion ?? 0) + 1;
  const feedback = [...(d?.versions ?? [])].reverse().find((v) => v.status === 'changes_requested');
  const submit = useProjectMutation(project._id, (body) => endpoints.projects.submitVersion(project._id, d._id, body), (_data, toast) => {
    setMediaUrl('');
    setChangeNote('');
    setUsed([]);
    toast.success(`v${next} sent to the brand.`);
  });

  if (!d) return null;
  const onSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^https?:\/\/\S+$/i.test(mediaUrl.trim())) errs.mediaUrl = 'Paste a full link starting with https://';
    if (next > 1 && !changeNote.trim()) errs.changeNote = 'Say what changed since the last version';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    submit.mutate({ mediaUrl: mediaUrl.trim(), changeNote: changeNote.trim() || undefined, toolsUsed: used });
  };
  return (
    <Card>
      <SectionHead
        title="Submit a new version"
        action={feedback && d.status === 'revision_requested' ? <Pill tone="att">Changes requested on v{feedback.number}</Pill> : null}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-5">
        {feedback && d.status === 'revision_requested' && (
          <div className="rounded-md border border-att-ln bg-att-bg px-4 py-3 text-att">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em]">Feedback on v{feedback.number}</p>
            <p className="mt-1 text-[14px] text-ink">
              “{feedback.feedback?.note}” — {feedback.feedback?.byName}
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13.5px] font-semibold">Deliverable</span>
            <select value={d._id} onChange={(e) => setId(e.target.value)} className="h-11 w-full rounded-md border border-line bg-white px-3 text-[14px]">
              {options.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <Input label="Version" value={`v${next}`} readOnly />
        </div>
        <Input label="Link to file" required placeholder="https://drive.google.com/file/d/…/v.mp4" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} error={errors.mediaUrl} />
        <Textarea
          label="What changed"
          required={next > 1}
          hint={next > 1 ? 'Required · shown to the brand' : 'Optional for v1 — “First version” if left empty'}
          rows={2}
          maxLength={1000}
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          error={errors.changeNote}
        />
        {tools.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-[13.5px] font-semibold">Tools used in this version</legend>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((t) => {
                const on = used.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setUsed(on ? used.filter((x) => x !== t) : [...used, t])}
                    className={`inline-flex items-center gap-1 rounded-[6px] border px-2.5 py-[3px] text-[12.5px] font-semibold ${on ? 'border-navy bg-navy text-white' : 'border-line2 bg-white text-slate'}`}
                  >
                    {on && <Check className="size-3" />} {t}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
        {submit.error && <Alert tone="error">{submit.error.message}</Alert>}
        <Button type="submit" loading={submit.isPending}>
          <Upload className="size-4" /> Submit v{next}
        </Button>
      </form>
    </Card>
  );
}

function DeliverableCard({ project, deliverable, role }) {
  const v = latestOf(deliverable);
  const awaiting = v?.status === 'submitted';
  const media = { _id: `${deliverable._id}-${v?.number}`, title: deliverable.title, mediaUrl: v?.mediaUrl, thumbnailUrl: v?.thumbnailUrl, mediaType: isVideo(v?.mediaUrl) ? 'video' : 'image' };
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[17px] tracking-[-0.02em]">{deliverable.title}</h2>
          {deliverable.specNote && <p className="text-[13px] text-steel">{deliverable.specNote}</p>}
        </div>
        {v ? (
          awaiting ? (
            <Pill tone="wait">v{v.number} · review needed</Pill>
          ) : (
            <StatusPill status={deliverable.status} />
          )
        ) : (
          <Pill>Not started</Pill>
        )}
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="relative">
          <MediaFrame item={media} aspect="aspect-[9/16] sm:aspect-[9/16]" showLabel={false} hover={false} className="max-sm:aspect-video" />
          {v && <span className="absolute left-2.5 top-2.5 rounded-[4px] bg-wait-bg px-1.5 font-mono text-[11px] font-bold text-wait">v{v.number}</span>}
        </div>
        <div className="min-w-0 space-y-5">
          <Timeline deliverable={deliverable} role={role} />
          {role === 'brand' && awaiting && !['completed', 'cancelled'].includes(project.status) && <DecisionBox project={project} deliverable={deliverable} />}
          {role === 'creator' && awaiting && (
            <p className="flex items-start gap-1.5 rounded-md border border-ok-ln bg-ok-bg px-3.5 py-3 text-[13.5px] text-ok">
              <Clock3 className="mt-0.5 size-3.5 shrink-0" /> v{v.number} sent to {project.brand?.companyName} {short(v.submittedAt)}. You’ll see their decision here and in messages.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function OtherDeliverables({ deliverables, currentId, role, onPick }) {
  const others = deliverables.filter((d) => d._id !== currentId);
  if (!others.length) return null;
  const approved = deliverables.filter((d) => d.status === 'approved').length;
  return (
    <Card>
      <SectionHead title="Other deliverables" action={<span className="text-[13px] text-steel">{approved} of {deliverables.length} approved</span>} />
      <ul>
        {others.map((d) => {
          const v = latestOf(d);
          const line = v ? `v${v.number} ${v.status === 'approved' ? 'approved' : v.status === 'submitted' ? 'waiting for review' : 'changes requested'} · ${short(v.feedback?.at ?? v.submittedAt)}` : 'Not started';
          return (
            <li key={d._id} className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0">
              <MediaFrame item={{ _id: d._id, title: d.title, mediaUrl: v?.mediaUrl, mediaType: isVideo(v?.mediaUrl) ? 'video' : 'image' }} aspect="aspect-square" showLabel={false} hover={false} className="w-14 shrink-0" />
              <button type="button" onClick={() => onPick(d._id)} className="min-w-0 flex-1 text-left">
                <b className="block truncate text-[15px] hover:text-navy">{d.title}</b>
                <span className="text-[13px] text-steel">{line}</span>
              </button>
              {role === 'creator' && !v ? (
                <Button size="sm" onClick={() => onPick(d._id, true)}>
                  <Upload className="size-3.5" /> Submit v1
                </Button>
              ) : v ? (
                v.status === 'submitted' ? <Pill tone="wait">Review needed</Pill> : <StatusPill status={d.status} />
              ) : (
                <Pill>Not started</Pill>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function FeedbackPanel({ project, role }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const submit = useProjectMutation(project._id, (body) => endpoints.projects.feedback(project._id, body), (_d, toast) => toast.success('Thanks. Your review is now on the creator’s profile.'));
  const fb = project.feedback;
  const name = project.creator?.displayName?.split(' ')[0] ?? 'the creator';
  return (
    <Card pad>
      <h2 className="text-[17px] tracking-[-0.02em]">{role === 'brand' ? `Rate ${name}` : 'Brand review'}</h2>
      {fb?.rating ? (
        <>
          <div className="mt-3 flex gap-1" aria-label={`${fb.rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, n) => (
              <Star key={n} className={`size-6 ${n < fb.rating ? 'fill-gold text-gold' : 'text-line2'}`} strokeWidth={1.5} />
            ))}
          </div>
          {fb.comment && <p className="mt-2 text-[14px] leading-relaxed">“{fb.comment}”</p>}
          <p className="mt-2 text-[12px] text-steel">Left {formatDate(fb.createdAt)} · shown on the creator’s public profile</p>
        </>
      ) : role === 'brand' ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rating) return setError('Choose a rating from 1 to 5.');
            setError('');
            submit.mutate({ rating, comment: comment.trim() });
          }}
        >
          <fieldset>
            <legend className="sr-only">Rating</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n} className="rounded p-0.5">
                  <Star className={`size-7 ${n <= rating ? 'fill-gold text-gold' : 'text-line2 hover:text-gold'}`} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </fieldset>
          <Textarea aria-label="Review" rows={3} maxLength={1000} placeholder="What was it like working together?" value={comment} onChange={(e) => setComment(e.target.value)} />
          {(error || submit.error) && <Alert tone="error">{error || submit.error.message}</Alert>}
          <Button type="submit" loading={submit.isPending}>
            Post review
          </Button>
          <p className="text-[12px] text-steel">Reviews are public, can be left once and can’t be edited.</p>
        </form>
      ) : (
        <p className="mt-2 text-[14px] text-steel">The brand hasn’t left a review yet.</p>
      )}
    </Card>
  );
}

/** S3 — final delivery: files, review, printable rights card. */
function Delivery({ project, role }) {
  const { data: taxonomy } = useTaxonomy();
  const card = project.rightsCard;
  const rights = project.rightsSnapshot ?? {};
  const base = rightsRows(rights, taxonomy);
  const valid = `${formatDate(card?.validFrom)} → ${card?.validTo ? formatDate(card.validTo) : 'Perpetual'}`;
  const rows = base.length
    ? [
        base[0],
        base[1],
        { label: 'Valid', value: valid },
        base[3],
        { label: 'Tools', value: card?.toolsUsed?.length ? `${card.toolsUsed.join(', ')}${rights.commerciallySafeTools !== false ? ' (commercial plans)' : ''}` : base[4].value },
        base[5],
        base[6],
      ]
    : [{ label: 'Rights', value: card?.summary ?? 'As agreed in the brief' }, { label: 'Valid', value: valid }];
  const files = project.deliverables.map((d) => ({ d, v: [...(d.versions ?? [])].reverse().find((x) => x.status === 'approved') ?? latestOf(d) }));
  const first = project.creator?.displayName?.split(' ')[0] ?? 'The creator';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 rounded-lg bg-[linear-gradient(120deg,var(--color-ink),#173029_70%,var(--color-navy))] px-5 py-6 text-white sm:px-7">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ok ring-8 ring-ok/25">
          <CircleCheck className="size-7" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ok-ln">Project completed · {formatDate(project.completedAt ?? card?.validFrom)}</p>
          <h1 className="mt-1 text-[26px] text-white sm:text-[34px]">
            All {project.deliverables.length} deliverable{project.deliverables.length > 1 ? 's' : ''} approved.
          </h1>
          <p className="mt-1 text-[14px] text-bone">
            {role === 'brand'
              ? `Files are yours to use within the rights below. ${first}’s profile gets ★ Made on UNIO for this project.`
              : 'Delivered. This project now counts towards your ★ Made on UNIO.'}
          </p>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHead title="Final files" />
            <ul>
              {files.map(({ d, v }) => (
                <li key={d._id} className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0">
                  <MediaFrame item={{ _id: d._id, title: d.title, mediaUrl: v?.mediaUrl, mediaType: isVideo(v?.mediaUrl) ? 'video' : 'image' }} aspect="aspect-square" showLabel={false} hover={false} className="w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{d.title}</b>
                    <span className="text-[13px] text-steel">{[v ? `v${v.number}` : null, d.specNote].filter(Boolean).join(' · ')}</span>
                  </div>
                  {v?.mediaUrl && (
                    <a href={v.mediaUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-navy hover:underline">
                      <ExternalLink className="size-3.5" /> Link
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <FeedbackPanel project={project} role={role} />
        </div>

        <div className="space-y-3.5">
          {card ? (
            <>
              <div className="print-area">
                <RightsTicket
                  eyebrow={`Rights & usage card · #${card.number}`}
                  title={project.campaign?.title}
                  number={`${card.brandName} ← ${card.creatorName}`}
                  stamp="LICENSED"
                  rows={rows}
                  note={null}
                />
                <p className="print-only mt-3 text-[12px]">A plain-language summary of what was agreed in the brief. Not a legal contract.</p>
              </div>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="size-4" /> Download PDF
              </Button>
              <p className="text-[13px] text-steel">A plain-language summary of what was agreed in the brief. Not a legal contract.</p>
            </>
          ) : (
            <Alert tone="info">The rights card is issued when every deliverable is approved.</Alert>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['mine', 'project', id], queryFn: () => endpoints.projects.get(id) });
  const project = query.data?.project;
  const role = query.data?.viewerRole;
  useDocumentTitle(project?.campaign?.title ?? 'Project');
  const [picked, setPicked] = useState(null);
  const [formFor, setFormFor] = useState(null);

  const setStatus = useProjectMutation(id, (status) => endpoints.projects.setStatus(id, status));
  useEffect(() => {
    // Opening the project refreshes unread badges.
    if (project) qc.invalidateQueries({ queryKey: ['me', 'unread'] });
  }, [project?._id, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const versions = useMemo(
    () => (project?.deliverables ?? []).flatMap((d) => (d.versions ?? []).map((v) => ({ deliverableId: d._id, number: v.number, label: `v${v.number}`, title: d.title }))),
    [project],
  );

  if (query.isLoading) return <PageLoader label="Loading project" />;
  if (query.error?.status === 404 || query.error?.status === 400) return <NotFoundPage what="project" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const ds = project.deliverables;
  const closed = ['completed', 'cancelled'].includes(project.status);
  // The deliverable that needs attention: brand → awaiting review; creator → changes requested / not started.
  const auto =
    role === 'brand'
      ? ds.find((d) => latestOf(d)?.status === 'submitted') ?? ds.find((d) => d.status !== 'approved') ?? ds[0]
      : ds.find((d) => d.status === 'revision_requested') ?? ds.find((d) => latestOf(d)?.status === 'submitted') ?? ds.find((d) => d.status !== 'approved') ?? ds[0];
  const current = ds.find((d) => d._id === picked) ?? auto;
  const canSubmit = role === 'creator' && !closed && ds.some((d) => d.status !== 'approved' && latestOf(d)?.status !== 'submitted');
  const latestTag = latestOf(current) ? `${current._id}:${latestOf(current).number}` : '';
  const tools = [...new Set([...(project.campaign?.requiredTools ?? []), ...ds.flatMap((d) => d.versions?.flatMap((v) => v.toolsUsed ?? []) ?? [])])];

  if (project.status === 'completed') {
    return (
      <div className="space-y-5">
        <Delivery project={project} role={role} />
        <div className="max-w-[760px]">
          <MessagesPanel projectId={project._id} versions={versions} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <ProjectHeader project={project} role={role} />
        <Tracker status={project.status} />
      </div>
      {project.status === 'cancelled' && <Alert tone="warning">This project was cancelled. The history stays here for both sides.</Alert>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          {canSubmit && (role === 'creator' && (current.status === 'revision_requested' || !latestOf(current) || formFor)) && (
            <SubmitVersionForm project={project} deliverables={ds} initialId={formFor ?? (latestOf(current)?.status === 'submitted' ? undefined : current._id)} tools={tools} />
          )}
          <DeliverableCard project={project} deliverable={current} role={role} />
          <OtherDeliverables
            deliverables={ds}
            currentId={current._id}
            role={role}
            onPick={(did, submit) => {
              setPicked(did);
              if (submit) setFormFor(did);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
          {role === 'brand' && !closed && (
            <ConfirmAction
              trigger={(open) => (
                <Button variant="ghost" size="sm" onClick={open}>
                  Cancel project
                </Button>
              )}
              title="Cancel this project?"
              body="Cancelling ends the project for both sides. This can’t be undone."
              confirmLabel="Cancel project"
              variant="danger"
              pending={setStatus.isPending}
              error={setStatus.error}
              onConfirm={() => setStatus.mutateAsync('cancelled')}
            />
          )}
        </div>
        <div className="xl:sticky xl:top-24">
          <MessagesPanel projectId={project._id} versions={versions} defaultAbout={latestTag} readOnly={project.status === 'cancelled'} />
        </div>
      </div>
    </div>
  );
}
