import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ExternalLink, Link2, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { StatusPill, Tag } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, Textarea } from '../../components/ui/Form.jsx';
import { isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, formatBudget } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import NotFoundPage from '../public/NotFoundPage.jsx';
import { deliverableProgress } from './ProjectsList.jsx';

/** Mirrors PROJECT_TRANSITIONS on the server; the API remains the source of truth. */
const ACTIONS = {
  creator: {
    not_started: [{ to: 'in_progress', label: 'Start project' }],
    in_progress: [{ to: 'submitted', label: 'Submit project for review', needs: 'allSubmitted' }],
    revision_requested: [
      { to: 'in_progress', label: 'Resume work', variant: 'secondary' },
      { to: 'submitted', label: 'Resubmit for review', needs: 'allSubmitted' },
    ],
  },
  brand: {
    not_started: [{ to: 'cancelled', label: 'Cancel project', variant: 'danger', confirm: true }],
    in_progress: [{ to: 'cancelled', label: 'Cancel project', variant: 'danger', confirm: true }],
    submitted: [
      { to: 'revision_requested', label: 'Request revision', variant: 'secondary' },
      { to: 'completed', label: 'Mark as completed', needs: 'allApproved', confirm: true },
      { to: 'cancelled', label: 'Cancel project', variant: 'danger', confirm: true },
    ],
    revision_requested: [{ to: 'cancelled', label: 'Cancel project', variant: 'danger', confirm: true }],
  },
};

function useProjectMutation(id, fn, successMessage) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      qc.setQueryData(['mine', 'project', id], data);
      qc.invalidateQueries({ queryKey: ['mine', 'projects'] });
      if (successMessage) toast.success(typeof successMessage === 'function' ? successMessage(data) : successMessage);
    },
  });
}

function DeliverableRow({ projectId, deliverable, index, role, locked }) {
  const [mediaUrl, setMediaUrl] = useState(deliverable.mediaUrl ?? '');
  const [urlError, setUrlError] = useState('');
  const update = useProjectMutation(projectId, (body) => endpoints.projects.updateDeliverable(projectId, deliverable._id, body), 'Deliverable updated.');

  const editable = role === 'creator' && !locked && ['pending', 'revision_requested'].includes(deliverable.status);
  const reviewable = role === 'brand' && !locked && deliverable.status === 'submitted';

  const validUrl = (v) => {
    try {
      const u = new URL(v);
      return ['http:', 'https:'].includes(u.protocol);
    } catch {
      return false;
    }
  };

  const submit = (status) => {
    const trimmed = mediaUrl.trim();
    if (trimmed && !validUrl(trimmed)) return setUrlError('Enter a full URL starting with https://');
    if (status === 'submitted' && !trimmed) return setUrlError('Add a media link before submitting');
    setUrlError('');
    update.mutate({ mediaUrl: trimmed, ...(status ? { status } : {}) });
  };

  return (
    <li className="grid gap-4 border-b border-line/60 py-6 last:border-0 md:grid-cols-12">
      <span className="font-mono text-xs text-steel md:col-span-1">{String(index + 1).padStart(2, '0')}</span>
      <div className="space-y-3 md:col-span-11">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{deliverable.title}</p>
            {deliverable.description && <p className="mt-0.5 text-[14px] text-steel">{deliverable.description}</p>}
            {deliverable.dueDate && (
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-steel">
                <CalendarDays className="size-3" /> Due {formatDate(deliverable.dueDate)}
              </p>
            )}
          </div>
          <StatusPill status={deliverable.status} />
        </div>

        {deliverable.mediaUrl && !editable && (
          <a
            href={deliverable.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 truncate rounded-sm bg-soft px-2 py-1 text-[13px] text-navy hover:underline"
          >
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">{isPlaceholderUrl(deliverable.mediaUrl) ? 'Placeholder media link' : deliverable.mediaUrl}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        )}

        {editable && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Input
              aria-label={`Media link for ${deliverable.title}`}
              placeholder="https://link-to-your-delivery"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              error={urlError}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => submit()} loading={update.isPending && !update.variables?.status} disabled={mediaUrl === (deliverable.mediaUrl ?? '')}>
                Save link
              </Button>
              <Button onClick={() => submit('submitted')} loading={update.isPending && update.variables?.status === 'submitted'}>
                Submit
              </Button>
            </div>
          </div>
        )}

        {reviewable && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => update.mutate({ status: 'revision_requested' })} loading={update.isPending && update.variables?.status === 'revision_requested'}>
              Request revision
            </Button>
            <Button size="sm" onClick={() => update.mutate({ status: 'approved' })} loading={update.isPending && update.variables?.status === 'approved'}>
              Approve
            </Button>
          </div>
        )}
        {update.error && <Alert tone="error">{update.error.message}</Alert>}
      </div>
    </li>
  );
}

function FeedbackPanel({ project, role }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const submit = useProjectMutation(project._id, (body) => endpoints.projects.feedback(project._id, body), 'Thanks. Your feedback is now on the creator’s profile.');

  if (project.status !== 'completed') return null;
  const fb = project.feedback;

  return (
    <div className="rounded-lg border border-line/70 bg-white p-5">
      <p className="eyebrow">Client feedback</p>
      {fb?.rating ? (
        <>
          <div className="mt-2 flex gap-0.5" aria-label={`${fb.rating} out of 5`}>
            {Array.from({ length: 5 }).map((_, n) => (
              <Star key={n} className={`size-4 ${n < fb.rating ? 'fill-navy text-navy' : 'text-steel'}`} strokeWidth={1.5} />
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
                  <Star className={`size-6 ${n <= rating ? 'fill-navy text-navy' : 'text-steel hover:text-navy/60'}`} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </fieldset>
          <Textarea aria-label="Comment" rows={3} maxLength={1000} placeholder="What was it like working together?" value={comment} onChange={(e) => setComment(e.target.value)} />
          {(error || submit.error) && <Alert tone="error">{error || submit.error.message}</Alert>}
          <p className="text-[12px] text-steel">Feedback is public, can be left once, and can’t be edited.</p>
          <Button type="submit" size="sm" loading={submit.isPending}>
            Publish feedback
          </Button>
        </form>
      ) : (
        <p className="mt-2 text-[14px] text-steel">The brand hasn’t left feedback for this project.</p>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['mine', 'project', id], queryFn: () => endpoints.projects.get(id) });
  const project = query.data?.project;
  const role = query.data?.viewerRole;
  useDocumentTitle(project?.campaign?.title ?? 'Project');

  const setStatus = useProjectMutation(id, (status) => endpoints.projects.setStatus(id, status), (d) => `Project is now ${d.project.status.replace('_', ' ')}.`);

  if (query.isLoading) return <PageLoader label="Loading project" />;
  if (query.error?.status === 404 || query.error?.status === 400) return <NotFoundPage what="project" />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  const deliverables = project.deliverables ?? [];
  const prog = deliverableProgress(project);
  const allSubmitted = deliverables.every((d) => ['submitted', 'approved'].includes(d.status));
  const allApproved = deliverables.every((d) => d.status === 'approved');
  const locked = ['completed', 'cancelled'].includes(project.status);
  const actions = ACTIONS[role]?.[project.status] ?? [];
  const backTo = role === 'brand' ? '/brand/projects' : '/creator/projects';

  return (
    <div>
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-ink">
          <ArrowLeft className="size-4" /> All projects
        </Link>

        <header className="mt-5 flex flex-col gap-6 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Project · via {project.sourceType}</p>
              <StatusPill status={project.status} />
            </div>
            <h1 className="mt-2 text-[30px] sm:text-[38px]">{project.campaign?.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-6 text-[14px]">
              <span className="flex items-center gap-2">
                <Avatar name={project.brand?.companyName ?? 'Brand'} size="sm" /> {project.brand?.companyName}
              </span>
              <span className="text-steel" aria-hidden>
                ⟷
              </span>
              <Link to={`/creators/${project.creatorId}`} className="flex items-center gap-2 hover:text-navy">
                <Avatar name={project.creator?.displayName ?? 'Creator'} src={project.creator?.photoUrl} size="sm" /> {project.creator?.displayName}
              </Link>
            </div>
          </div>
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => {
                const blocked = (a.needs === 'allSubmitted' && !allSubmitted) || (a.needs === 'allApproved' && !allApproved);
                const button = (onClick) => (
                  <Button
                    key={a.to}
                    variant={a.variant ?? 'primary'}
                    onClick={onClick}
                    disabled={blocked}
                    loading={!a.confirm && setStatus.isPending && setStatus.variables === a.to}
                    title={blocked ? (a.needs === 'allApproved' ? 'Approve every deliverable first' : 'Submit every deliverable first') : undefined}
                  >
                    {a.label}
                  </Button>
                );
                return a.confirm ? (
                  <ConfirmAction
                    key={a.to}
                    title={`${a.label}?`}
                    body={a.to === 'cancelled' ? 'Cancelling ends the project for both sides. This can’t be undone.' : 'This closes the project as delivered.'}
                    confirmLabel={a.label}
                    variant={a.variant ?? 'primary'}
                    pending={setStatus.isPending && setStatus.variables === a.to}
                    error={setStatus.variables === a.to ? setStatus.error : null}
                    onConfirm={() => setStatus.mutateAsync(a.to)}
                    trigger={button}
                  />
                ) : (
                  button(() => setStatus.mutate(a.to))
                );
              })}
            </div>
          )}
        </header>
        {setStatus.error && !actions.find((a) => a.confirm && a.to === setStatus.variables) && (
          <Alert tone="error" className="mt-4">
            {setStatus.error.message}
          </Alert>
        )}

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-lg border border-line/70 bg-white px-5 sm:px-6">
            <div className="flex items-center justify-between border-b border-line py-4">
              <h2 className="text-[17px] tracking-[-0.02em]">Deliverables</h2>
              <span className="font-mono text-xs text-steel">
                {prog.approved}/{prog.total} approved
              </span>
            </div>
            {role === 'creator' && !locked && (
              <p className="border-b border-line/60 py-3 text-[13px] text-steel">
                Paste a link to each finished file (Drive, Cloudinary, Frame.io…) and submit it. The brand approves or asks for changes per deliverable.
              </p>
            )}
            <ol>
              {deliverables.map((d, i) => (
                <DeliverableRow key={d._id} projectId={id} deliverable={d} index={i} role={role} locked={locked} />
              ))}
            </ol>
          </section>

          <aside className="space-y-4">
            <FeedbackPanel project={project} role={role} />
            <div className="rounded-lg border border-line/70 bg-white p-5">
              <p className="eyebrow">Brief</p>
              <p className="mt-2 line-clamp-[8] text-[14px] leading-relaxed text-ink/85">{project.campaign?.brief}</p>
              <Link to={`/campaigns/${project.campaignId}`} className="mt-3 inline-block text-[13px] text-navy hover:underline">
                Open full brief
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line/70 bg-white p-5 text-[14px]">
              <div>
                <dt className="eyebrow">Budget</dt>
                <dd className="mt-1 font-bold tabular-nums text-[13px]">{formatBudget(project.campaign?.budgetMin, project.campaign?.budgetMax)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Deadline</dt>
                <dd className="mt-1">{formatDate(project.campaign?.deadline)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Started</dt>
                <dd className="mt-1">{formatDate(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="eyebrow">Updated</dt>
                <dd className="mt-1">{formatDate(project.updatedAt)}</dd>
              </div>
            </dl>
            {(project.campaign?.requiredTools?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-line/70 bg-white p-5">
                <p className="eyebrow mb-2">Preferred tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {project.campaign.requiredTools.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
