import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Inbox, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { DemoBadge, StatusPill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Select, Textarea } from '../../components/ui/Form.jsx';
import { MediaFrame, isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate, pluralize } from '../../lib/format.js';
import { statusLabel } from '../../lib/status.js';
import { endpoints } from '../../services/api.js';

const TYPE_LABEL = { tool: 'AI tool', workflow: 'Workflow', portfolio: 'Portfolio piece' };

function ReviewDialog({ submission, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const decide = useMutation({
    mutationFn: (decision) => endpoints.review.decide(submission._id, { decision, note: note.trim() }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['review'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(data.status === 'VERIFIED' ? 'Marked as verified.' : 'Rejected with feedback to the creator.');
      onClose();
    },
  });

  const reject = () => {
    if (note.trim().length < 10) return setNoteError('Explain what is missing (at least 10 characters) so the creator can fix it.');
    setNoteError('');
    decide.mutate('REJECTED');
  };

  const s = submission;
  const pending = s.status === 'PENDING';
  return (
    <Dialog open onClose={onClose} title={s.subject} description={`${TYPE_LABEL[s.type]} · ${s.creator?.displayName ?? 'Creator'}`} size="lg">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={s.status} />
          {s.creator?.isDemo && <DemoBadge />}
          {s.submittedAt && <span className="text-[13px] text-steel">Submitted {formatDate(s.submittedAt)}</span>}
          <Link to={`/creators/${s.creatorId}`} target="_blank" className="ml-auto text-[13px] text-navy hover:underline">
            Open public profile
          </Link>
        </div>

        {s.portfolioItem && (
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <MediaFrame item={s.portfolioItem} aspect="aspect-[4/5]" hover={false} />
            <div className="space-y-2 text-[14px]">
              <p className="eyebrow">Portfolio piece under review</p>
              <p className="font-semibold">{s.portfolioItem.title}</p>
              {s.portfolioItem.description && <p className="text-steel">{s.portfolioItem.description}</p>}
              <a href={s.portfolioItem.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-navy hover:underline">
                <ExternalLink className="size-3.5" /> Media file{isPlaceholderUrl(s.portfolioItem.mediaUrl) ? ' (placeholder)' : ''}
              </a>
            </div>
          </div>
        )}

        {s.description && (
          <div>
            <p className="eyebrow mb-1.5">{s.type === 'workflow' ? 'Workflow description' : 'Creator notes'}</p>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{s.description}</p>
          </div>
        )}

        <div>
          <p className="eyebrow mb-1.5">Evidence</p>
          {s.evidenceUrls?.length ? (
            <ul className="space-y-1.5">
              {s.evidenceUrls.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-[14px] text-navy hover:underline">
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{u}</span>
                  </a>
                  {isPlaceholderUrl(u) && <span className="ml-2 text-[12px] text-steel">placeholder link, cannot be checked</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-steel">No evidence links.</p>
          )}
        </div>

        {pending ? (
          <>
            <Alert tone="info">
              Open every link. Verify only if the evidence clearly shows this creator using the tool, running the workflow, or producing the piece.
            </Alert>
            <Textarea
              label="Note to the creator"
              hint="Required when rejecting. Shown to the creator, not the public."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={noteError}
              maxLength={1000}
            />
            {decide.error && <Alert tone="error">{decide.error.message}</Alert>}
            <div className="flex flex-col-reverse gap-2 border-t border-line/60 pt-5 sm:flex-row sm:justify-end">
              <Button variant="danger" onClick={reject} loading={decide.isPending && decide.variables === 'REJECTED'}>
                Reject
              </Button>
              <Button onClick={() => decide.mutate('VERIFIED')} loading={decide.isPending && decide.variables === 'VERIFIED'}>
                Mark as verified
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-line/70 bg-white p-4 text-[14px]">
            <p>
              {statusLabel(s.status)} on {formatDate(s.reviewedAt)}
            </p>
            {s.reviewNote && <p className="mt-1 text-steel">{s.reviewNote}</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function ReviewQueue() {
  useDocumentTitle('Review queue');
  const [status, setStatus] = useState('PENDING');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(null);
  const query = useQuery({
    queryKey: ['review', { status, type, page }],
    queryFn: () => endpoints.review.list({ status, type, page, limit: 20 }),
  });
  const counts = query.data?.counts ?? {};

  return (
    <>
      <PageHeader
        eyebrow="Reviewer"
        title="Verification queue"
        description="Check creators’ evidence for tools, workflows and portfolio pieces. Decisions appear on public profiles immediately."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-full overflow-x-auto">
          <div className="inline-flex rounded-full border border-line2 bg-white p-[3px]" role="tablist" aria-label="Filter by status">
            {['PENDING', 'VERIFIED', 'REJECTED', 'SELF_REPORTED'].map((s) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={status === s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-[13px] py-1.5 text-[13px] font-semibold transition-colors ${status === s ? 'bg-navy text-white' : 'text-steel hover:text-ink'}`}
              >
                {statusLabel(s)} · {counts[s] ?? 0}
              </button>
            ))}
          </div>
        </div>
        <Select aria-label="Filter by type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">All types</option>
          <option value="tool">AI tools</option>
          <option value="workflow">Workflows</option>
          <option value="portfolio">Portfolio pieces</option>
        </Select>
      </div>

      {query.isLoading ? (
        <Skeleton className="h-48" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.items.length === 0 ? (
        <EmptyState icon={status === 'PENDING' ? Inbox : ShieldAlert} title={status === 'PENDING' ? 'Queue is clear' : 'Nothing here'}>
          {status === 'PENDING' ? 'No submissions are waiting for review.' : 'No submissions with this status.'}
        </EmptyState>
      ) : (
        <>
          <ul className="overflow-hidden rounded-lg border border-line/70 bg-white">
            {query.data.items.map((s) => (
              <li key={s._id} className="border-b border-line/60 last:border-0">
                <button type="button" onClick={() => setActive(s)} className="grid w-full gap-3 px-5 py-4 text-left hover:bg-soft/40 md:grid-cols-12 md:items-center">
                  <div className="flex min-w-0 items-center gap-3 md:col-span-4">
                    <Avatar name={s.creator?.displayName ?? '?'} src={s.creator?.photoUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{s.subject}</p>
                      <p className="truncate text-[13px] text-steel">{s.creator?.displayName}</p>
                    </div>
                  </div>
                  <span className="text-[13px] text-steel md:col-span-2">{TYPE_LABEL[s.type]}</span>
                  <span className="text-[13px] text-steel md:col-span-2">{pluralize(s.evidenceUrls?.length ?? 0, 'evidence link')}</span>
                  <span className="text-[13px] text-steel md:col-span-2">{formatDate(s.status === 'PENDING' ? s.submittedAt : s.reviewedAt ?? s.updatedAt)}</span>
                  <span className="md:col-span-2 md:text-right">
                    <StatusPill status={s.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={setPage} />
          </div>
        </>
      )}

      {active && <ReviewDialog key={active._id} submission={active} onClose={() => setActive(null)} />}
    </>
  );
}
