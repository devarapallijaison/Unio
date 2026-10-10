import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { StatusPill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, Select, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate } from '../../lib/format.js';
import { TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const TYPES = [
  { value: 'tool', label: 'AI tool', hint: 'Show you actually use a tool: project files, process recordings, exports.' },
  { value: 'workflow', label: 'Workflow', hint: 'Describe a repeatable AI pipeline and link to a breakdown or behind-the-scenes.' },
  { value: 'portfolio', label: 'Portfolio piece', hint: 'Prove a piece is your work: source files, timeline screenshots, prompt history.' },
];

const url = z.string().trim().url('Enter a full URL starting with https://');
const schema = z
  .object({
    type: z.enum(['tool', 'workflow', 'portfolio']),
    subject: z.string().trim().max(120).optional(),
    portfolioItemId: z.string().optional(),
    description: z.string().trim().max(2000).optional(),
    evidence: z.array(z.object({ url: z.union([z.literal(''), url]) })).max(5),
  })
  .superRefine((v, ctx) => {
    if (v.type !== 'portfolio' && (v.subject ?? '').length < 2) ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Name the tool or workflow' });
    if (v.type === 'portfolio' && !v.portfolioItemId) ctx.addIssue({ code: 'custom', path: ['portfolioItemId'], message: 'Choose a portfolio piece' });
    if (v.type === 'workflow' && (v.description ?? '').length < 30) {
      ctx.addIssue({ code: 'custom', path: ['description'], message: 'Describe the workflow in at least 30 characters' });
    }
  });

function VerificationForm({ entry, preset, portfolio, existingKeys, profileTools, onDone }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isEdit = !!entry;
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      type: entry?.type ?? preset?.type ?? 'tool',
      subject: entry?.subject ?? '',
      portfolioItemId: entry?.portfolioItemId ?? preset?.portfolioItemId ?? '',
      description: entry?.description ?? '',
      evidence: (entry?.evidenceUrls?.length ? entry.evidenceUrls : ['']).map((u) => ({ url: u })),
    },
  });
  const { register, handleSubmit, watch, control, formState, setError, setValue } = form;
  const evidence = useFieldArray({ control, name: 'evidence' });
  const type = watch('type');
  const [intent, setIntent] = useState('submit');

  const save = useMutation({
    mutationFn: ({ values, submit }) => {
      const evidenceUrls = values.evidence.map((e) => e.url.trim()).filter(Boolean);
      if (isEdit) {
        return endpoints.creator.updateVerification(entry._id, {
          ...(entry.type !== 'portfolio' ? { subject: values.subject } : {}),
          description: values.description ?? '',
          evidenceUrls,
          submit,
        });
      }
      return endpoints.creator.createVerification({
        type: values.type,
        ...(values.type === 'portfolio' ? { portfolioItemId: values.portfolioItemId } : { subject: values.subject }),
        description: values.description ?? '',
        evidenceUrls,
        submit,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mine', 'verifications'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(data.status === 'PENDING' ? 'Submitted for review.' : 'Saved as self-reported.');
      onDone();
    },
    onError: (err) => {
      for (const d of err.details ?? []) {
        if (d.field === 'evidenceUrls') setError('evidence', { message: d.message });
      }
      applyServerErrors({ details: (err.details ?? []).filter((d) => d.field !== 'evidenceUrls') }, setError);
    },
  });

  const onSubmit = (values) => save.mutate({ values, submit: intent === 'submit' });
  const available = portfolio.filter((p) => !existingKeys.has(`portfolio:${p._id}`) || p._id === entry?.portfolioItemId);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {!isEdit && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">What are you verifying?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label
                key={t.value}
                className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${type === t.value ? 'border-forest bg-mint/60' : 'border-beige bg-white hover:border-forest/50'}`}
              >
                <input type="radio" value={t.value} className="sr-only" {...register('type')} />
                <span className="font-medium">{t.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-muted">{TYPES.find((t) => t.value === type)?.hint}</p>
        </fieldset>
      )}

      {type === 'tool' && (
        <>
          <Input label="Tool" required list="verify-tools" placeholder="e.g. Kling" error={formState.errors.subject?.message} {...register('subject')} />
          <datalist id="verify-tools">
            {[...new Set([...profileTools, ...TOOLS])].map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {!isEdit && profileTools.length > 0 && (
            <div className="-mt-2 flex flex-wrap gap-1.5">
              {profileTools
                .filter((t) => !existingKeys.has(`tool:${t.toLowerCase()}`))
                .map((t) => (
                  <button key={t} type="button" onClick={() => setValue('subject', t)} className="rounded-sm border border-dashed border-beige px-2 py-0.5 text-[12px] text-muted hover:border-forest hover:text-forest">
                    {t}
                  </button>
                ))}
            </div>
          )}
        </>
      )}
      {type === 'workflow' && (
        <Input label="Workflow name" required placeholder="e.g. Storyboard → Kling → CapCut" error={formState.errors.subject?.message} {...register('subject')} />
      )}
      {type === 'portfolio' &&
        (isEdit ? (
          <p className="rounded-md border border-beige/70 bg-white px-3 py-2 text-sm">{entry.subject}</p>
        ) : available.length ? (
          <Select label="Portfolio piece" required error={formState.errors.portfolioItemId?.message} {...register('portfolioItemId')}>
            <option value="">Choose a piece</option>
            {available.map((p) => (
              <option key={p._id} value={p._id}>
                {p.title}
              </option>
            ))}
          </Select>
        ) : (
          <Alert tone="info">Every portfolio piece already has a verification entry, or your portfolio is empty.</Alert>
        ))}

      <Textarea
        label={type === 'workflow' ? 'How the workflow works' : 'Notes for the reviewer (optional)'}
        required={type === 'workflow'}
        rows={type === 'workflow' ? 5 : 3}
        hint={type === 'workflow' ? 'Steps, tools at each step, and what you do by hand.' : 'Point the reviewer at what to look for in your evidence.'}
        error={formState.errors.description?.message}
        {...register('description')}
      />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Evidence links</legend>
        <p className="mb-2 text-[13px] text-muted">
          Public links a reviewer can open: process recordings, project-file screenshots, a Behance breakdown. Required to submit for review.
        </p>
        <div className="space-y-2">
          {evidence.fields.map((field, i) => (
            <div key={field.id} className="flex items-start gap-2">
              <Input
                aria-label={`Evidence link ${i + 1}`}
                placeholder="https://"
                className="flex-1"
                error={formState.errors.evidence?.[i]?.url?.message}
                {...register(`evidence.${i}.url`)}
              />
              {evidence.fields.length > 1 && (
                <Button variant="ghost" size="sm" className="mt-1.5" onClick={() => evidence.remove(i)} aria-label={`Remove link ${i + 1}`}>
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {formState.errors.evidence?.message && <p className="mt-1.5 text-[13px] text-danger">{formState.errors.evidence.message}</p>}
        {evidence.fields.length < 5 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => evidence.append({ url: '' })}>
            <Plus className="size-3.5" /> Add another link
          </Button>
        )}
      </fieldset>

      {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}

      <div className="flex flex-col-reverse gap-2 border-t border-beige/60 pt-5 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="submit" variant="secondary" onClick={() => setIntent('save')} loading={save.isPending && intent === 'save'}>
            Save as self-reported
          </Button>
          <Button type="submit" onClick={() => setIntent('submit')} loading={save.isPending && intent === 'submit'}>
            Submit for review
          </Button>
        </div>
      </div>
    </form>
  );
}

function EntryCard({ entry, onEdit }) {
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () => endpoints.creator.deleteVerification(entry._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine', 'verifications'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success('Verification entry removed.');
    },
  });

  return (
    <li className="min-w-0 rounded-lg border border-beige/70 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{entry.subject}</p>
          <p className="text-[13px] text-muted">
            {entry.status === 'PENDING' && entry.submittedAt && `Submitted ${formatDate(entry.submittedAt)}`}
            {['VERIFIED', 'REJECTED'].includes(entry.status) && entry.reviewedAt && `Reviewed ${formatDate(entry.reviewedAt)}`}
            {entry.status === 'SELF_REPORTED' && 'Not submitted for review'}
          </p>
        </div>
        <StatusPill status={entry.status} />
      </div>
      {entry.description && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink/85">{entry.description}</p>}
      {entry.evidenceUrls?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {entry.evidenceUrls.map((u) => (
            <li key={u}>
              <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] text-forest hover:underline">
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{isPlaceholderUrl(u) ? `${u} (placeholder)` : u}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {entry.reviewNote && entry.status !== 'VERIFIED' && (
        <Alert tone={entry.status === 'REJECTED' ? 'error' : 'info'} title={entry.status === 'REJECTED' ? 'Reviewer feedback' : undefined} className="mt-4">
          {entry.reviewNote}
        </Alert>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-beige/60 pt-3">
        <ConfirmAction
          title="Remove this entry?"
          body={entry.status === 'VERIFIED' ? 'Your verified status for this will be removed from your public profile.' : 'This removes the claim and its evidence.'}
          confirmLabel="Remove"
          variant="danger"
          pending={del.isPending}
          error={del.error}
          onConfirm={() => del.mutateAsync()}
          trigger={(open) => (
            <Button variant="ghost" size="sm" onClick={open}>
              <Trash2 className="size-3.5" /> Remove
            </Button>
          )}
        />
        {entry.status !== 'VERIFIED' && (
          <Button variant={entry.status === 'REJECTED' || entry.status === 'SELF_REPORTED' ? 'subtle' : 'ghost'} size="sm" onClick={() => onEdit(entry)}>
            <Pencil className="size-3.5" />
            {entry.status === 'REJECTED' ? 'Fix and resubmit' : entry.status === 'SELF_REPORTED' ? 'Add evidence' : 'Edit'}
          </Button>
        )}
      </div>
    </li>
  );
}

export default function CreatorVerification() {
  useDocumentTitle('Verification');
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // null | { entry?, preset? }
  const list = useQuery({ queryKey: ['mine', 'verifications'], queryFn: endpoints.creator.verifications });
  const portfolio = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const profile = useQuery({ queryKey: ['mine', 'creator-profile'], queryFn: endpoints.creator.profile });

  // Deep link from the Portfolio page: /creator/verification?portfolio=<id>
  useEffect(() => {
    const id = params.get('portfolio');
    if (!id || !list.data) return;
    const existing = list.data.find((e) => e.portfolioItemId === id);
    setEditing(existing ? { entry: existing } : { preset: { type: 'portfolio', portfolioItemId: id } });
    setParams({}, { replace: true });
  }, [params, list.data, setParams]);

  const entries = list.data ?? [];
  const keys = new Set(entries.map((e) => e.key));
  const groups = [
    ['tool', 'AI tools'],
    ['workflow', 'Workflows'],
    ['portfolio', 'Portfolio evidence'],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Trust"
        title="Verification"
        description="Back up your tools, workflows and portfolio pieces with evidence. A UNIO reviewer checks each submission. Only reviewers can mark something as verified."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> Add claim
          </Button>
        }
      />

      <dl className="mb-8 grid gap-px overflow-hidden rounded-lg border border-beige/70 bg-beige/70 sm:grid-cols-4">
        {[
          ['SELF_REPORTED', 'Listed by you, no evidence reviewed. Shown as “Self-reported”.'],
          ['PENDING', 'Evidence submitted. A reviewer will check it.'],
          ['VERIFIED', 'A reviewer confirmed it. Shown with a check mark.'],
          ['REJECTED', 'Evidence wasn’t enough. Read the note, fix and resubmit. Publicly shown as self-reported.'],
        ].map(([s, d]) => (
          <div key={s} className="bg-white p-4">
            <StatusPill status={s} />
            <p className="mt-2 text-[13px] leading-snug text-muted">{d}</p>
          </div>
        ))}
      </dl>

      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : entries.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No verification claims yet" action={<Button onClick={() => setEditing({})}>Add your first claim</Button>}>
          Start with the tool you use most. Link a process recording or project file so a reviewer can confirm it.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {groups.map(([type, title]) => {
            const items = entries.filter((e) => e.type === type);
            if (!items.length) return null;
            return (
              <section key={type}>
                <h2 className="mb-3 font-sans text-[15px] font-semibold">{title}</h2>
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
                  {items.map((e) => (
                    <EntryCard key={e._id} entry={e} onEdit={(entry) => setEditing({ entry })} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.entry ? `Edit: ${editing.entry.subject}` : 'Add a verification claim'}
        description="Save it as self-reported, or attach evidence and submit it for review."
      >
        {editing && (
          <VerificationForm
            key={editing.entry?._id ?? editing.preset?.portfolioItemId ?? 'new'}
            entry={editing.entry}
            preset={editing.preset}
            portfolio={portfolio.data ?? []}
            existingKeys={keys}
            profileTools={profile.data?.tools ?? []}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
