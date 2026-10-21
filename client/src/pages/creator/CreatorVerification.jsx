import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Image as ImageIcon, Paperclip, Pencil, Plus, Send, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { StatusPill, Pill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, Select, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { isPlaceholderUrl } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ToolChip, TrustLadder } from '../../components/ui/Trust.jsx';
import { UploadButton } from '../../components/ui/Upload.jsx';
import { PreChecks } from '../../components/verification/PreChecks.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { formatDate } from '../../lib/format.js';
import { TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const TYPES = [
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
      type: entry?.type ?? preset?.type ?? 'workflow',
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
          <legend className="mb-2 text-[13px] font-semibold">What are you verifying?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label
                key={t.value}
                className={`cursor-pointer rounded-md border p-3 text-sm transition-colors ${type === t.value ? 'border-navy bg-soft/60' : 'border-line bg-white hover:border-navy/50'}`}
              >
                <input type="radio" value={t.value} className="sr-only" {...register('type')} />
                <span className="font-semibold">{t.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-steel">{TYPES.find((t) => t.value === type)?.hint}</p>
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
                  <button key={t} type="button" onClick={() => setValue('subject', t)} className="rounded-sm border border-dashed border-line px-2 py-0.5 text-[12px] text-steel hover:border-navy hover:text-navy">
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
          <p className="rounded-md border border-line/70 bg-white px-3 py-2 text-sm">{entry.subject}</p>
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
        <legend className="mb-2 text-[13px] font-semibold">Evidence links</legend>
        <p className="mb-2 text-[13px] text-steel">
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
        {formState.errors.evidence?.message && <p className="mt-1.5 text-[13px] text-att">{formState.errors.evidence.message}</p>}
        {evidence.fields.length < 5 && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => evidence.append({ url: '' })}>
            <Plus className="size-3.5" /> Add another link
          </Button>
        )}
      </fieldset>

      {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}

      <div className="flex flex-col-reverse gap-2 border-t border-line/60 pt-5 sm:flex-row sm:justify-between">
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
    <li className="min-w-0 rounded-lg border border-line/70 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{entry.subject}</p>
          <p className="text-[13px] text-steel">
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
              <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-[13px] text-navy hover:underline">
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
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line/60 pt-3">
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
        {entry.status !== 'VERIFIED' && entry.method !== 'challenge' && entry.method !== 'certificate' && (
          <Button variant={entry.status === 'REJECTED' || entry.status === 'SELF_REPORTED' ? 'subtle' : 'ghost'} size="sm" onClick={() => onEdit(entry)}>
            <Pencil className="size-3.5" />
            {entry.status === 'REJECTED' ? 'Fix and resubmit' : entry.status === 'SELF_REPORTED' ? 'Add evidence' : 'Edit'}
          </Button>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* UNIO Trust (C7): verify a tool with a one-time challenge code        */
/* ------------------------------------------------------------------ */

const same = (a, b) => a.toLowerCase().trim() === b.toLowerCase().trim();
const httpsOk = (v) => /^https:\/\/[^\s]+$/i.test(v.trim());

const LEVEL_COPY = [
  ['Self-reported', 'Nothing has been reviewed yet. Verify a tool to move up.'],
  ['Pending review', 'Your evidence is with a UNIO reviewer.'],
  ['Certified', 'A certificate you submitted was checked by a reviewer.'],
  ['Verified', 'At least one of your tools is verified by a UNIO reviewer.'],
  ['★ Made on UNIO', 'Your highest level. Keep tools verified to stay here.'],
];

/** Re-render every `ms` so countdowns stay honest without a request. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function timeLeft(until, now) {
  const mins = Math.max(0, Math.floor((new Date(until) - now) / 60000));
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

/** Trust state of one tool from the creator's own claims. Mirrors the server's priority. */
function describeTool(name, entries) {
  const mine = entries.filter((e) => (e.type === 'tool' || e.type === 'certificate') && same(e.subject, name));
  const verified = mine.find((e) => e.type === 'tool' && e.status === 'VERIFIED' && !e.expired);
  const certified = mine.find((e) => e.type === 'certificate' && e.status === 'VERIFIED' && !e.expired);
  const pending = mine.find((e) => e.status === 'PENDING');
  const toolClaim = mine.find((e) => e.type === 'tool');
  if (verified) return { state: 'verified', claim: verified };
  if (certified) return { state: 'certified', claim: certified };
  if (pending) return { state: 'pending', claim: pending };
  return { state: 'self', claim: toolClaim, lapsed: mine.find((e) => e.expired) };
}

function Steps({ current }) {
  const steps = ['Pick tool', 'Record with code', 'Submit'];
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const cur = i === current;
        return (
          <li
            key={label}
            aria-current={cur ? 'step' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${cur ? 'border-navy bg-navy text-white' : done ? 'border-line bg-soft text-slate' : 'border-line bg-soft text-steel'}`}
          >
            <span className={`grid size-5 place-items-center rounded-full text-[11px] ${done ? 'bg-ok text-white' : cur ? 'bg-white text-navy' : 'bg-line text-steel'}`}>
              {done ? <Check className="size-3" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function VerifyTool({ entries, profileTools, tool, setTool }) {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const [recording, setRecording] = useState('');
  const [shots, setShots] = useState(['', '']);
  const [formError, setFormError] = useState('');

  const claim = tool ? entries.find((e) => e.type === 'tool' && same(e.subject, tool)) : undefined;
  const active = claim && claim.method === 'challenge' && claim.challengeCode && !claim.challengeUsedAt && claim.status !== 'PENDING' && new Date(claim.challengeExpiresAt) > now;
  const expiredCode = claim && claim.method === 'challenge' && claim.challengeCode && !claim.challengeUsedAt && claim.status !== 'PENDING' && !active;
  const submittedClaim = claim?.status === 'PENDING' && claim.method === 'challenge' ? claim : null;
  const step = submittedClaim ? 2 : active ? 1 : 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['mine', 'verifications'] });
    qc.invalidateQueries({ queryKey: ['mine', 'creator-profile'] });
    qc.invalidateQueries({ queryKey: ['pub'] });
  };
  const getCode = useMutation({
    mutationFn: (name) => endpoints.creator.verificationChallenge(name),
    onSuccess: (data) => {
      setTool(data.subject);
      setRecording('');
      setShots(['', '']);
      setFormError('');
      refresh();
    },
  });
  const send = useMutation({
    mutationFn: () => endpoints.creator.submitVerification(claim._id, { recordingUrl: recording.trim(), screenshotUrls: shots.map((s) => s.trim()).filter(Boolean) }),
    onSuccess: () => {
      toast.success('Submitted. A UNIO reviewer will check it.');
      refresh();
    },
    onError: refresh,
  });

  const choices = [...new Set([...profileTools, ...TOOLS])].filter((t) => {
    const d = describeTool(t, entries);
    return d.state === 'self' || (d.state !== 'pending' && d.claim?.expiringSoon);
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!httpsOk(recording)) return setFormError('Add the recording link. It must start with https://');
    if (shots.some((s) => s.trim() && !httpsOk(s))) return setFormError('Screenshot links must start with https://');
    setFormError('');
    send.mutate();
  };

  return (
    <Card>
      <SectionHead title="Verify a tool" action={<Pill tone="info">Step {step + 1} of 3</Pill>} />
      <div className="space-y-5 p-5">
        <Steps current={step} />

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-[14px] text-steel">
              Pick a tool you use. We give you a one-time code to type into the tool on screen while you record, so a reviewer can see it is really you.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select label="Tool" className="flex-1" value={tool} onChange={(e) => setTool(e.target.value)}>
                <option value="">Choose a tool</option>
                {choices.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Button onClick={() => getCode.mutate(tool)} disabled={!tool} loading={getCode.isPending}>
                Get my code
              </Button>
            </div>
            {expiredCode && (
              <Alert tone="warning">The code for {claim.subject} expired. Get a new one and record again.</Alert>
            )}
            {claim?.reviewNote && claim.status !== 'PENDING' && (
              <Alert tone={claim.status === 'REJECTED' ? 'error' : 'info'} title="Reviewer note">
                {claim.reviewNote}
              </Alert>
            )}
            {getCode.error && <Alert tone="error">{getCode.error.message}</Alert>}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="relative overflow-hidden rounded-lg bg-ink p-6 text-white">
              <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full border-[18px] border-white/[0.05]" />
              <p className="eyebrow text-mist">Your one-time challenge code · {claim.subject}</p>
              <p className="mt-3 font-mono text-[40px] font-medium tracking-[0.1em] sm:text-[54px]" aria-label={`Challenge code ${claim.challengeCode.split('').join(' ')}`}>
                {claim.challengeCode}
              </p>
              <p className="mt-3 text-[13px] text-bone">
                Valid for {timeLeft(claim.challengeExpiresAt, now)} · works once · type it into your prompt on screen
              </p>
            </div>
            <ol className="list-decimal space-y-1.5 pl-5 text-[14px]">
              <li>Start a screen recording showing your {claim.subject} account</li>
              <li>
                Type <code className="rounded-sm border border-line2 bg-soft px-1.5 py-0.5 font-mono text-[12px]">{claim.challengeCode}</code> into the prompt and generate
              </li>
              <li>Keep recording until the result appears (1–3 min)</li>
              <li>Add the recording link and at least 2 screenshots below</li>
            </ol>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Input label="Recording link" required placeholder="https://drive.google.com/…" value={recording} onChange={(e) => setRecording(e.target.value)} />
                <UploadButton purpose="evidence" label="Upload the recording" onUploaded={({ url }) => setRecording(url)} />
              </div>
              <div className="space-y-2">
                {shots.map((s, i) => (
                  <Input key={i} label={i === 0 ? 'Screenshot links' : undefined} aria-label={`Screenshot link ${i + 1}`} placeholder="https://" value={s} onChange={(e) => setShots(shots.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
                <UploadButton
                  purpose="evidence"
                  label="Upload a screenshot"
                  onUploaded={({ url }) =>
                    setShots((prev) => {
                      const free = prev.findIndex((x) => !x.trim());
                      return free >= 0 ? prev.map((x, j) => (j === free ? url : x)) : [...prev, url].slice(0, 5);
                    })
                  }
                />
                {shots.length < 4 && (
                  <Button variant="ghost" size="sm" onClick={() => setShots([...shots, ''])}>
                    <Plus className="size-3.5" /> Add a screenshot link
                  </Button>
                )}
              </div>
            </div>
            <Alert tone="ai">Automatic pre-checks run first (links open, code window, screenshots). They are hints and can be wrong. Then a UNIO reviewer decides.</Alert>
            {formError && <Alert tone="error">{formError}</Alert>}
            {send.error && (
              <Alert tone="error">
                {send.error.message}
                {['CHALLENGE_EXPIRED', 'CODE_USED', 'NO_ACTIVE_CHALLENGE'].includes(send.error.code) && ' Get a new code to try again.'}
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={send.isPending}>
                Submit for review <Send className="size-4" />
              </Button>
              <Button variant="ghost" onClick={() => getCode.mutate(claim.subject)} loading={getCode.isPending}>
                Get a different code
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Alert tone="success" title={`${submittedClaim.subject} is with a reviewer`}>
              Submitted {formatDate(submittedClaim.submittedAt)}. You will see the decision here, and your public profile updates as soon as it is made.
            </Alert>
            <PreChecks checks={submittedClaim.checks} />
            <Button variant="secondary" onClick={() => setTool('')}>
              Verify another tool
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ToolRow({ name, entries, onVerify }) {
  const { state, claim, lapsed } = describeTool(name, entries);
  const monthYear = { month: 'short', year: 'numeric' };
  let line = 'Self-reported';
  let sub = 'Counts half in matching';
  if (state === 'verified') {
    line = `Verified ${formatDate(claim.reviewedAt)}`;
    sub = claim.expiringSoon ? `${claim.expiresInDays} ${claim.expiresInDays === 1 ? 'day' : 'days'} left` : `Expires ${formatDate(claim.expiresAt, monthYear)}`;
  } else if (state === 'certified') {
    line = `Certificate checked${claim.certificate?.issuer ? ` · ${claim.certificate.issuer}` : ''}`;
    sub = claim.expiringSoon ? `${claim.expiresInDays} days left` : `Expires ${formatDate(claim.expiresAt, monthYear)}`;
  } else if (state === 'pending') {
    line = `In review · submitted ${formatDate(claim.submittedAt)}`;
    sub = 'A reviewer will decide';
  } else if (lapsed) {
    line = 'Expired. Verify again';
    sub = `Was verified until ${formatDate(lapsed.expiresAt, monthYear)}`;
  } else if (claim?.reviewNote && claim.status !== 'PENDING') {
    line = claim.status === 'REJECTED' ? 'Not verified' : 'Reviewer asked for more';
    sub = claim.reviewNote;
  }
  const canVerify = state === 'self' || (state !== 'pending' && claim?.expiringSoon);
  return (
    <li className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
      <ToolChip name={name} state={state} />
      <div className="min-w-0 flex-1 text-[13px]">
        <p className={claim?.expiringSoon ? 'font-semibold text-wait' : ''}>{line}</p>
        <p className="truncate text-steel">{sub}</p>
      </div>
      {canVerify && (
        <Button variant="ghost" size="sm" onClick={() => onVerify(name)}>
          {state === 'self' ? 'Verify' : 'Re-verify'}
        </Button>
      )}
    </li>
  );
}

function CertificateForm({ entry, profileTools, onDone }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState({
    subject: entry?.subject ?? '',
    issuer: entry?.certificate?.issuer ?? '',
    title: entry?.certificate?.title ?? '',
    verifyUrl: entry?.certificate?.verifyUrl ?? '',
    fileUrl: entry?.certificate?.fileUrl ?? '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const save = useMutation({
    mutationFn: (submit) => {
      const certificate = { issuer: v.issuer.trim(), verifyUrl: v.verifyUrl.trim(), ...(v.title.trim() ? { title: v.title.trim() } : {}), ...(v.fileUrl.trim() ? { fileUrl: v.fileUrl.trim() } : {}) };
      return entry
        ? endpoints.creator.submitVerification(entry._id, { certificate })
        : endpoints.creator.createVerification({ type: 'certificate', subject: v.subject.trim(), certificate, submit });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mine', 'verifications'] });
      qc.invalidateQueries({ queryKey: ['mine', 'creator-profile'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(data.status === 'PENDING' ? 'Submitted. A reviewer will open your verify link.' : 'Saved. Submit it when you are ready.');
      onDone();
    },
  });

  const go = (submit) => {
    if (v.subject.trim().length < 2) return setError('Name the tool this certificate is for');
    if (v.issuer.trim().length < 2) return setError('Who issued it? e.g. Coursera');
    if (!httpsOk(v.verifyUrl)) return setError('The verify link is required and must start with https://');
    if (v.fileUrl.trim() && !httpsOk(v.fileUrl)) return setError('The file link must start with https://');
    setError('');
    save.mutate(submit);
  };

  return (
    <div className="space-y-4">
      <Input label="Tool" required list="cert-tools" disabled={!!entry} value={v.subject} onChange={set('subject')} placeholder="e.g. Midjourney" />
      <datalist id="cert-tools">
        {[...new Set([...profileTools, ...TOOLS])].map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Issuer" required value={v.issuer} onChange={set('issuer')} placeholder="e.g. Coursera" disabled={!!entry} />
        <Input label="Certificate title" value={v.title} onChange={set('title')} placeholder="e.g. Midjourney for designers" />
      </div>
      <Input label="Verify link" required hint="The issuer's page where anyone can confirm this certificate. A reviewer opens it." value={v.verifyUrl} onChange={set('verifyUrl')} placeholder="https://" />
      <div className="space-y-2">
        <Input label="Certificate file link (optional)" value={v.fileUrl} onChange={set('fileUrl')} placeholder="https://" />
        <UploadButton purpose="certificate" label="Upload the certificate" onUploaded={({ url }) => setV((cur) => ({ ...cur, fileUrl: url }))} />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {save.error && <Alert tone="error">{save.error.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {!entry && (
            <Button variant="secondary" onClick={() => go(false)} loading={save.isPending && save.variables === false}>
              Save for later
            </Button>
          )}
          <Button onClick={() => go(true)} loading={save.isPending && save.variables !== false}>
            Submit for review
          </Button>
        </div>
      </div>
    </div>
  );
}

function CertificatesCard({ entries, profileTools }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | {} | { entry }
  const certs = entries.filter((e) => e.type === 'certificate');
  const del = useMutation({
    mutationFn: (id) => endpoints.creator.deleteVerification(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine', 'verifications'] });
      qc.invalidateQueries({ queryKey: ['mine', 'creator-profile'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success('Certificate removed.');
    },
  });
  const stateOf = (c) => (c.status === 'VERIFIED' && !c.expired ? 'certified' : c.status === 'PENDING' ? 'pending' : 'self');
  const lineOf = (c) => {
    const who = [c.certificate?.issuer, c.certificate?.title].filter(Boolean).join(' · ');
    if (c.status === 'VERIFIED') return c.expired ? `${who} · expired, submit it again` : `${who} · verify link checked`;
    if (c.status === 'PENDING') return `${who} · link opened, in review`;
    if (c.reviewNote) return `${who} · ${c.reviewNote}`;
    return `${who} · saved, not submitted`;
  };

  return (
    <Card pad className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold">Certificates</h3>
        <Button variant="secondary" size="sm" onClick={() => setEditing({})}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {certs.length === 0 ? (
        <p className="text-[13px] text-steel">A course or tool certificate with a public verify link counts as “Certified” after a reviewer checks it.</p>
      ) : (
        <ul className="space-y-2">
          {certs.map((c) => (
            <li key={c._id} className="flex items-center gap-2.5 rounded-md bg-soft px-3 py-2.5">
              <ToolChip name={c.subject} state={stateOf(c)} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-steel" title={lineOf(c)}>
                {lineOf(c)}
              </span>
              {c.status !== 'PENDING' && (c.status !== 'VERIFIED' || c.expired) && (
                <Button variant="ghost" size="sm" onClick={() => setEditing({ entry: c })} aria-label={`Edit ${c.subject} certificate`}>
                  <Pencil className="size-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => del.mutate(c._id)} aria-label={`Remove ${c.subject} certificate`}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.entry ? `Edit: ${editing.entry.subject} certificate` : 'Add a certificate'} description="A reviewer opens the verify link. Approved certificates show as “Certified”.">
        {editing && <CertificateForm key={editing.entry?._id ?? 'new'} entry={editing.entry} profileTools={profileTools} onDone={() => setEditing(null)} />}
      </Dialog>
    </Card>
  );
}

export default function CreatorVerification() {
  useDocumentTitle('UNIO Trust');
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // legacy claim dialog: null | { entry?, preset? }
  const [tool, setTool] = useState('');
  const verifyRef = useRef(null);
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
  const profileTools = profile.data?.tools ?? [];
  const toolNames = [...new Set([...profileTools, ...entries.filter((e) => e.type === 'tool').map((e) => e.subject)])];
  const level = profile.data?.trustLevel ?? 1;
  const others = entries.filter((e) => e.type === 'workflow' || e.type === 'portfolio');

  const states = toolNames.map((n) => describeTool(n, entries).state);
  const certCount = entries.filter((e) => e.type === 'certificate' && e.status === 'VERIFIED' && !e.expired).length;
  const piecesVerified = entries.filter((e) => e.type === 'portfolio' && e.status === 'VERIFIED').length;

  const startVerify = (name) => {
    setTool(name);
    verifyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (list.isLoading || profile.isLoading) return <Skeleton className="h-96" />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.refetch} />;

  return (
    <div className="space-y-5">
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-xl bg-[linear-gradient(120deg,var(--color-ink)_0%,var(--color-navy)_55%,var(--color-slate)_100%)] p-6 text-white sm:p-8">
        <div className="max-w-xl space-y-3">
          <p className="eyebrow text-mist">UNIO Trust</p>
          <h1 className="text-[32px] text-white sm:text-[38px]">{LEVEL_COPY[level - 1][0]}</h1>
          <p className="text-bone">{LEVEL_COPY[level - 1][1]}</p>
          <TrustLadder level={level} dark className="max-w-[520px] pt-1" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [ShieldCheck, 'Tools', `${states.filter((s) => s === 'verified').length} verified · ${states.filter((s) => s === 'pending').length} in review`],
          [Paperclip, 'Certificates', `${certCount} checked`],
          [ImageIcon, 'Past work', `${portfolio.data?.length ?? 0} ${portfolio.data?.length === 1 ? 'piece' : 'pieces'} · ${piecesVerified} verified`],
          [Star, 'On UNIO', `${profile.data?.madeOnUnioCount ?? 0} ${profile.data?.madeOnUnioCount === 1 ? 'project' : 'projects'} delivered`],
        ].map(([Icon, title, detail]) => (
          <Card key={title} pad>
            <span className="grid size-9 place-items-center rounded-full border border-line2 bg-white text-navy">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-2.5 font-bold">{title}</p>
            <p className="text-[13px] text-steel">{detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div ref={verifyRef} className="scroll-mt-24">
          <VerifyTool entries={entries} profileTools={profileTools} tool={tool} setTool={setTool} />
        </div>
        <div className="space-y-5">
          <Card>
            <SectionHead title="Your tools" />
            {toolNames.length ? (
              <ul>
                {toolNames.map((n) => (
                  <ToolRow key={n} name={n} entries={entries} onVerify={startVerify} />
                ))}
              </ul>
            ) : (
              <p className="p-5 text-[13px] text-steel">Add the tools you use to your profile, then verify them here.</p>
            )}
          </Card>
          <CertificatesCard entries={entries} profileTools={profileTools} />
        </div>
      </div>

      <Card>
        <SectionHead
          title="Workflows and portfolio evidence"
          action={
            <Button variant="secondary" size="sm" onClick={() => setEditing({})}>
              <Plus className="size-3.5" /> Add claim
            </Button>
          }
        />
        <div className="p-5">
          {others.length === 0 ? (
            <p className="text-[13px] text-steel">Back up a workflow or a portfolio piece with links a reviewer can open: process recordings, project files, breakdowns.</p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
              {others.map((e) => (
                <EntryCard key={e._id} entry={e} onEdit={(entry) => setEditing({ entry })} />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <p className="text-[12.5px] text-steel">
        Approvals last 12 months. We warn you 30 days before one ends; after that the tool counts as self-reported again. Only reviewers can mark something verified.
      </p>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.entry ? `Edit: ${editing.entry.subject}` : 'Add a claim'}
        description="Save it as self-reported, or attach evidence and submit it for review."
      >
        {editing && (
          <VerificationForm
            key={editing.entry?._id ?? editing.preset?.portfolioItemId ?? 'new'}
            entry={editing.entry}
            preset={editing.preset}
            portfolio={portfolio.data ?? []}
            existingKeys={keys}
            profileTools={profileTools}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
