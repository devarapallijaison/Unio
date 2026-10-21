import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCircle2, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { formatBudget, formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { RightsStrip } from '../ui/Rights.jsx';
import { Button, ButtonLink } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Field, Input, Textarea, applyServerErrors } from '../ui/Form.jsx';
import { MediaFrame } from '../ui/MediaFrame.jsx';

const MAX_SAMPLES = 3;

const schema = z.object({
  proposedPrice: z.union([z.literal(''), z.coerce.number().min(0, 'Price can’t be negative').max(100_000_000)]).optional(),
  proposal: z.string().trim().min(20, 'Write at least 20 characters so the brand understands your approach').max(3000),
  acceptedRights: z.literal(true, { errorMap: () => ({ message: 'Read the rights & usage terms and tick the box to apply' }) }),
});

/** Up to three of the creator's own pieces, sent with the application as "relevant work". */
function WorkPicker({ selected, onChange }) {
  const [open, setOpen] = useState(false);
  const portfolio = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const items = portfolio.data ?? [];
  const chosen = selected.map((id) => items.find((p) => p._id === id)).filter(Boolean);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, MAX_SAMPLES));

  return (
    <Field label="Relevant work" hint={items.length ? `Optional · up to ${MAX_SAMPLES} pieces from your portfolio` : undefined}>
      {portfolio.isSuccess && !items.length ? (
        <p className="text-[13px] text-steel">
          No pieces yet.{' '}
          <Link to="/creator/portfolio" className="font-semibold text-navy underline">
            Add work
          </Link>{' '}
          to show brands what you’ve made.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {chosen.map((p) => (
            <button key={p._id} type="button" onClick={() => toggle(p._id)} className="size-14 overflow-hidden rounded-[8px] border border-line" title={`Remove “${p.title}”`}>
              <MediaFrame item={p} aspect="aspect-square" showLabel={false} hover={false} className="rounded-none" />
            </button>
          ))}
          {chosen.length < MAX_SAMPLES && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="grid size-14 place-items-center rounded-[8px] border border-dashed border-line2 text-steel hover:border-navy hover:text-navy"
              aria-label="Choose relevant work"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Choose relevant work" description={`Pick up to ${MAX_SAMPLES} pieces. Brands see them next to your pitch.`} size="lg">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((p) => {
            const on = selected.includes(p._id);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggle(p._id)}
                disabled={!on && selected.length >= MAX_SAMPLES}
                aria-pressed={on}
                className={`relative overflow-hidden rounded-md border text-left disabled:opacity-40 ${on ? 'border-navy ring-2 ring-navy' : 'border-line'}`}
              >
                <MediaFrame item={p} aspect="aspect-[4/3]" showLabel={false} hover={false} className="rounded-none" />
                <span className="block truncate px-2.5 py-2 text-[12.5px] font-semibold">{p.title}</span>
                {on && (
                  <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-navy text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <Button onClick={() => setOpen(false)}>Done · {selected.length} of {MAX_SAMPLES}</Button>
        </div>
      </Dialog>
    </Field>
  );
}

/**
 * v9 P5 apply card for a signed-in creator: price, pitch, relevant work and the rights checkbox.
 * "Send application" opens a review step — nothing is submitted until the creator confirms.
 */
export function ApplyForm({ campaign, autoFocus = false }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(null); // null | 'review' | 'done'
  const [samples, setSamples] = useState([]);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { proposedPrice: '', proposal: '', acceptedRights: false } });
  const { register, handleSubmit, formState, getValues, setError } = form;

  const apply = useMutation({
    mutationFn: (body) => endpoints.campaigns.apply(campaign._id, body),
    onSuccess: () => {
      setStep('done');
      qc.invalidateQueries({ queryKey: ['mine'] });
    },
    onError: (err) => {
      if (err.details?.length) {
        applyServerErrors(err, setError);
        setStep(null);
      }
    },
  });

  const values = getValues();
  const price = values.proposedPrice === '' || values.proposedPrice == null ? null : Number(values.proposedPrice);
  const closeDialog = () => {
    if (step === 'done') qc.invalidateQueries({ queryKey: ['pub', 'campaign', campaign._id] });
    setStep(null);
    apply.reset();
  };

  return (
    <>
      <form onSubmit={handleSubmit(() => setStep('review'))} className="space-y-[18px]" noValidate>
        <Input
          label="Your price"
          type="number"
          min="0"
          inputMode="numeric"
          prefix="₹"
          hint={`Brand budget: ${formatBudget(campaign.budgetMin, campaign.budgetMax)}`}
          error={formState.errors.proposedPrice?.message}
          {...register('proposedPrice')}
        />
        <Textarea
          label="Pitch"
          required
          rows={4}
          hint="What you’ll make and why you"
          autoFocus={autoFocus}
          error={formState.errors.proposal?.message}
          {...register('proposal')}
        />
        <WorkPicker selected={samples} onChange={setSamples} />
        <div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-navy" aria-invalid={!!formState.errors.acceptedRights} {...register('acceptedRights')} />
            <span className="text-[14px] font-medium">
              I’ve read the{' '}
              <a href="#rights" className="underline decoration-line2 underline-offset-2 hover:decoration-navy">
                rights &amp; usage terms
              </a>
            </span>
          </label>
          {formState.errors.acceptedRights && <p className="mt-1.5 text-[12.5px] font-medium text-att">{formState.errors.acceptedRights.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full">
          Send application <Send className="size-4" />
        </Button>
      </form>

      <Dialog
        open={step != null}
        onClose={closeDialog}
        title={step === 'done' ? 'Application sent' : 'Review your application'}
        description={step === 'done' ? undefined : campaign.title}
      >
        {step === 'review' && (
          <div className="space-y-5">
            <dl className="divide-y divide-line rounded-md border border-line bg-white">
              <div className="px-4 py-3">
                <dt className="eyebrow">Your price</dt>
                <dd className="mt-1 font-bold tabular-nums">{price != null ? formatINR(price) : 'Not specified'}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="eyebrow">Pitch</dt>
                <dd className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{values.proposal}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="eyebrow">Relevant work</dt>
                <dd className="mt-1 text-[14px]">{samples.length ? `${samples.length} piece${samples.length > 1 ? 's' : ''} attached` : 'None attached'}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="eyebrow">Rights you’re agreeing to</dt>
                <dd className="mt-2">
                  <RightsStrip summary={campaign.rightsSummary} />
                </dd>
              </div>
            </dl>
            <p className="text-[13px] text-steel">You can apply to each campaign once. You can withdraw while the application is pending.</p>
            {apply.error && !apply.error.details?.length && <Alert tone="error">{apply.error.message}</Alert>}
            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(null)}>
                <ArrowLeft className="size-4" /> Edit
              </Button>
              <Button
                loading={apply.isPending}
                onClick={() =>
                  apply.mutate({
                    proposal: values.proposal.trim(),
                    ...(price != null ? { proposedPrice: price } : {}),
                    acceptedRights: true,
                    ...(samples.length ? { samplePieceIds: samples } : {}),
                  })
                }
              >
                Confirm and submit
              </Button>
            </div>
          </div>
        )}
        {step === 'done' && (
          <div className="space-y-5 py-2">
            <CheckCircle2 className="size-8 text-navy" strokeWidth={1.5} />
            <p className="text-[15px] text-steel">
              Your proposal is with the brand. You’ll see their decision in your applications — accepted applications become a project automatically.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink to="/creator/applications">View my applications</ButtonLink>
              <ButtonLink to="/campaigns" variant="ghost">
                Browse more briefs
              </ButtonLink>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
