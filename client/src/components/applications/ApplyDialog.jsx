import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { formatBudget, formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { Button, ButtonLink } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Input, Textarea, applyServerErrors } from '../ui/Form.jsx';

const schema = z.object({
  proposal: z.string().trim().min(20, 'Write at least 20 characters so the brand understands your approach').max(3000),
  proposedPrice: z
    .union([z.literal(''), z.coerce.number().min(0, 'Price can’t be negative').max(100_000_000)])
    .optional(),
});

/**
 * Two-step application: write → review → confirm. Nothing is submitted until the creator
 * explicitly confirms on the review step.
 */
export function ApplyDialog({ open, onClose, campaign }) {
  const qc = useQueryClient();
  const [step, setStep] = useState('write');
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { proposal: '', proposedPrice: '' } });
  const { register, handleSubmit, formState, getValues, setError } = form;

  const apply = useMutation({
    mutationFn: (body) => endpoints.campaigns.apply(campaign._id, body),
    onSuccess: () => {
      setStep('done');
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub', 'campaign', campaign._id] });
    },
    onError: (err) => {
      if (err.details?.length) {
        applyServerErrors(err, setError);
        setStep('write');
      }
    },
  });

  const close = () => {
    if (step === 'done') form.reset();
    setStep(step === 'done' ? 'write' : step);
    apply.reset();
    onClose();
  };

  const values = getValues();
  const price = values.proposedPrice === '' || values.proposedPrice == null ? null : Number(values.proposedPrice);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={step === 'review' ? 'Review your application' : step === 'done' ? 'Application sent' : 'Apply to this brief'}
      description={step === 'done' ? undefined : campaign.title}
    >
      {step === 'write' && (
        <form onSubmit={handleSubmit(() => setStep('review'))} className="space-y-5" noValidate>
          <Textarea
            label="Your proposal"
            required
            rows={7}
            hint="Explain your approach, which tools you’ll use, and a realistic timeline."
            error={formState.errors.proposal?.message}
            {...register('proposal')}
          />
          <Input
            label="Your price (optional)"
            type="number"
            min="0"
            inputMode="numeric"
            prefix="₹"
            hint={`Brand budget: ${formatBudget(campaign.budgetMin, campaign.budgetMax)}`}
            error={formState.errors.proposedPrice?.message}
            {...register('proposedPrice')}
          />
          <div className="flex flex-col-reverse gap-2 border-t border-beige/60 pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Review application</Button>
          </div>
        </form>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <dl className="divide-y divide-beige/60 rounded-md border border-beige/80 bg-white">
            <div className="px-4 py-3">
              <dt className="eyebrow">Campaign</dt>
              <dd className="mt-1 font-medium">{campaign.title}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="eyebrow">Proposal</dt>
              <dd className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{values.proposal}</dd>
            </div>
            <div className="px-4 py-3">
              <dt className="eyebrow">Your price</dt>
              <dd className="mt-1 font-mono">{price != null ? formatINR(price) : 'Not specified'}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted">You can apply to each campaign once. You can withdraw while the application is pending.</p>
          {apply.error && !apply.error.details?.length && <Alert tone="error">{apply.error.message}</Alert>}
          <div className="flex flex-col-reverse gap-2 border-t border-beige/60 pt-5 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStep('write')}>
              <ArrowLeft className="size-4" /> Edit
            </Button>
            <Button
              loading={apply.isPending}
              onClick={() => apply.mutate({ proposal: values.proposal.trim(), ...(price != null ? { proposedPrice: price } : {}) })}
            >
              Confirm and submit
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-5 py-2">
          <CheckCircle2 className="size-8 text-forest" strokeWidth={1.5} />
          <p className="text-[15px] text-muted">
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
  );
}
