import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { z } from 'zod';
import { AiBriefBuilder } from '../../components/campaigns/AiBriefBuilder.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, TagInput, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { safeReturnTo } from '../../lib/returnTo.js';
import { CATEGORIES, SKILLS, TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const money = z.union([z.literal(''), z.coerce.number().min(0, 'Must be 0 or more').max(100_000_000)]);

const schema = z
  .object({
    title: z.string().trim().min(4, 'Use at least 4 characters').max(160),
    category: z.string().trim().min(2, 'Choose or type a category').max(80),
    brief: z.string().trim().min(20, 'Describe the brief in at least 20 characters').max(5000),
    budgetMin: money,
    budgetMax: money,
    deadline: z.string().optional(),
    requiredSkills: z.array(z.string()).max(30),
    requiredTools: z.array(z.string()).max(30),
    deliverables: z
      .array(
        z.object({
          title: z.string().trim().min(1, 'Name this deliverable').max(160),
          description: z.string().trim().max(1000),
          quantity: z.coerce.number().int().min(1, 'At least 1').max(100),
        }),
      )
      .max(20),
    status: z.enum(['draft', 'open', 'closed']),
  })
  .refine((v) => v.budgetMin === '' || v.budgetMax === '' || Number(v.budgetMax) >= Number(v.budgetMin), {
    path: ['budgetMax'],
    message: 'Maximum must be at least the minimum',
  });

const EMPTY = {
  title: '',
  category: '',
  brief: '',
  budgetMin: '',
  budgetMax: '',
  deadline: '',
  requiredSkills: [],
  requiredTools: [],
  deliverables: [{ title: '', description: '', quantity: 1 }],
  status: 'open',
};

function toForm(c) {
  return {
    ...EMPTY,
    ...c,
    budgetMin: c.budgetMin ?? '',
    budgetMax: c.budgetMax ?? '',
    deadline: c.deadline ? new Date(c.deadline).toISOString().slice(0, 10) : '',
    deliverables: c.deliverables?.length ? c.deliverables.map((d) => ({ description: '', ...d })) : EMPTY.deliverables,
  };
}

function toBody(v) {
  return {
    title: v.title,
    category: v.category,
    brief: v.brief,
    budgetMin: v.budgetMin === '' ? null : Number(v.budgetMin),
    budgetMax: v.budgetMax === '' ? null : Number(v.budgetMax),
    deadline: v.deadline ? new Date(`${v.deadline}T00:00:00.000Z`).toISOString() : null,
    requiredSkills: v.requiredSkills,
    requiredTools: v.requiredTools,
    deliverables: v.deliverables,
    status: v.status,
  };
}

export default function CampaignFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  useDocumentTitle(isEdit ? 'Edit campaign' : 'New campaign');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const qc = useQueryClient();
  const toast = useToast();

  const existing = useQuery({ queryKey: ['mine', 'brand-campaign', id], queryFn: () => endpoints.brand.campaign(id), enabled: isEdit });

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, handleSubmit, control, reset, formState, setError, watch, getValues } = form;
  const [beforeDraft, setBeforeDraft] = useState(null);

  // AI/template drafts only fill the form (as a draft); the brand edits and saves explicitly.
  const applyDraft = (fields) => {
    if (!beforeDraft) setBeforeDraft(getValues());
    reset(
      {
        ...EMPTY,
        title: fields.title,
        category: fields.category,
        brief: fields.brief,
        budgetMin: fields.budgetMin ?? '',
        budgetMax: fields.budgetMax ?? '',
        deadline: fields.deadline ?? '',
        requiredSkills: fields.requiredSkills ?? [],
        requiredTools: fields.requiredTools ?? [],
        deliverables: fields.deliverables?.length ? fields.deliverables : EMPTY.deliverables,
        status: 'draft',
      },
      { keepDefaultValues: true },
    );
  };
  const undoDraft = () => {
    if (beforeDraft) reset(beforeDraft, { keepDefaultValues: true });
    setBeforeDraft(null);
  };
  const deliverables = useFieldArray({ control, name: 'deliverables' });

  useEffect(() => {
    if (existing.data) reset(toForm(existing.data));
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (v) => (isEdit ? endpoints.brand.updateCampaign(id, toBody(v)) : endpoints.brand.createCampaign(toBody(v))),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(isEdit ? 'Campaign updated.' : data.status === 'open' ? 'Campaign published.' : 'Campaign saved as draft.');
      navigate(returnTo ?? (isEdit ? '/brand/campaigns' : `/brand/campaigns/${data._id}/applicants`));
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  if (isEdit && existing.isLoading) return <PageLoader label="Loading campaign" />;
  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.refetch} />;

  const status = watch('status');

  return (
    <>
      <PageHeader
        eyebrow={isEdit ? 'Edit' : 'New brief'}
        title={isEdit ? 'Edit campaign' : 'Create a campaign'}
        description="A clear brief gets better proposals. Be specific about format, tone and what you’ll approve."
      />
      {returnTo?.includes('intent=invite') && (
        <Alert tone="info" className="mb-6">
          Publish this campaign as <strong>Open</strong> and you’ll be taken back to the creator to send your invitation.
        </Alert>
      )}
      {!isEdit && <AiBriefBuilder onApply={applyDraft} onUndo={undoDraft} canUndo={!!beforeDraft} />}
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
        <section className="grid gap-5 rounded-lg border border-line/70 bg-white p-6">
          <Input label="Campaign title" required placeholder="e.g. Summer SPF launch — vertical ads" error={formState.errors.title?.message} {...register('title')} />
          <Input
            label="Category"
            required
            list="campaign-categories"
            placeholder="e.g. Beauty"
            error={formState.errors.category?.message}
            {...register('category')}
          />
          <datalist id="campaign-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Textarea
            label="Brief"
            required
            rows={8}
            hint="What are you launching, who is it for, what should it feel like, and what must be avoided?"
            error={formState.errors.brief?.message}
            {...register('brief')}
          />
        </section>

        <section className="grid gap-5 rounded-lg border border-line/70 bg-white p-6 sm:grid-cols-3">
          <Input label="Budget from" type="number" min="0" prefix="₹" error={formState.errors.budgetMin?.message} {...register('budgetMin')} />
          <Input label="Budget to" type="number" min="0" prefix="₹" error={formState.errors.budgetMax?.message} {...register('budgetMax')} />
          <Input label="Deadline" type="date" error={formState.errors.deadline?.message} {...register('deadline')} />
        </section>

        <section className="grid gap-5 rounded-lg border border-line/70 bg-white p-6">
          <Controller name="requiredSkills" control={control} render={({ field }) => <TagInput label="Skills needed" value={field.value} onChange={field.onChange} suggestions={SKILLS} />} />
          <Controller name="requiredTools" control={control} render={({ field }) => <TagInput label="Preferred AI tools" value={field.value} onChange={field.onChange} suggestions={TOOLS} />} />
        </section>

        <section className="rounded-lg border border-line/70 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-sans text-[15px] font-semibold">Deliverables</h2>
              <p className="text-[13px] text-steel">Each one becomes a trackable item in the project.</p>
            </div>
            <Button variant="subtle" size="sm" onClick={() => deliverables.append({ title: '', description: '', quantity: 1 })} disabled={deliverables.fields.length >= 20}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          <ol className="space-y-3">
            {deliverables.fields.map((field, i) => (
              <li key={field.id} className="grid gap-3 rounded-md border border-line/70 bg-page p-4 sm:grid-cols-[1fr_1.4fr_90px_auto] sm:items-start">
                <Input label="Title" error={formState.errors.deliverables?.[i]?.title?.message} {...register(`deliverables.${i}.title`)} />
                <Input label="Format / notes" placeholder="15–30s, 9:16" {...register(`deliverables.${i}.description`)} />
                <Input label="Qty" type="number" min="1" error={formState.errors.deliverables?.[i]?.quantity?.message} {...register(`deliverables.${i}.quantity`)} />
                <Button variant="ghost" size="sm" className="sm:mt-7" onClick={() => deliverables.remove(i)} aria-label={`Remove deliverable ${i + 1}`}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border border-line/70 bg-white p-6">
          <fieldset>
            <legend className="mb-3 font-sans text-[15px] font-semibold">Visibility</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['open', 'Open', 'Listed publicly. Creators can apply and you can invite.'],
                ['draft', 'Draft', 'Only you can see it. Publish when ready.'],
                ...(isEdit ? [['closed', 'Closed', 'Hidden from the directory. Applications stay on record.']] : []),
              ].map(([value, label, body]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-md border p-4 transition-colors ${status === value ? 'border-navy bg-soft/60' : 'border-line hover:border-navy/50'}`}
                >
                  <input type="radio" value={value} className="sr-only" {...register('status')} />
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-1 block text-[13px] text-steel">{body}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
        {Object.keys(formState.errors).length > 0 && formState.isSubmitted && <Alert tone="error">Please fix the highlighted fields.</Alert>}

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-line/70 bg-page/95 px-4 py-4 sm:mx-0 sm:rounded-lg sm:border sm:px-5">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Save changes' : status === 'open' ? 'Publish campaign' : 'Save draft'}
          </Button>
        </div>
      </form>
    </>
  );
}
