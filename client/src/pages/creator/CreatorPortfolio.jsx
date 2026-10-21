import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Link2, Pencil, Plus, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Pill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Checkbox, ChipSelect, Field, Input, Select, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { MadeOnUnio } from '../../components/ui/Trust.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { UploadButton, useUploadConfig } from '../../components/ui/Upload.jsx';
import { captureVideoFrame } from '../../lib/media.js';
import { endpoints, uploadFile } from '../../services/api.js';

/* v9 C3 — portfolio grid + "Add a piece" panel with "How it was made" steps. Media are links (uploads: Phase 10). */

const url = z.string().trim().url('Enter a full URL starting with https://');
const optNum = (min, max) => z.union([z.literal(''), z.coerce.number().int().min(min).max(max)]);

const schema = z.object({
  title: z.string().trim().min(2, 'Give this piece a title').max(160),
  description: z.string().trim().max(1000),
  mediaType: z.enum(['image', 'video']),
  mediaUrl: url,
  thumbnailUrl: z.union([z.literal(''), url]),
  contentType: z.string(),
  format: z.string(),
  industry: z.string(),
  skills: z.array(z.string()),
  styles: z.array(z.string()),
  workflow: z
    .array(z.object({ tool: z.string().min(1, 'Pick a tool'), version: z.string().trim().max(30), generations: optNum(0, 100000), note: z.string().trim().max(200) }))
    .max(12),
  versionsCount: optNum(1, 50),
  timeTakenDays: optNum(0, 365),
  client: z.enum(['personal', 'client']),
  licensedTo: z.string().trim().max(160),
  licenceSummary: z.string().trim().max(300),
  briefSummary: z.string().trim().max(500),
  deliveredSummary: z.string().trim().max(500),
  featured: z.boolean(),
});

const EMPTY = {
  title: '', description: '', mediaType: 'image', mediaUrl: '', thumbnailUrl: '', contentType: '', format: '', industry: '',
  skills: [], styles: [], workflow: [], versionsCount: '', timeTakenDays: '', client: 'personal', licensedTo: '', licenceSummary: '',
  briefSummary: '', deliveredSummary: '', featured: false,
};

function toForm(item) {
  if (!item) return EMPTY;
  return {
    ...EMPTY,
    title: item.title ?? '',
    description: item.description ?? '',
    mediaType: item.mediaType ?? 'image',
    mediaUrl: item.mediaUrl ?? '',
    thumbnailUrl: item.thumbnailUrl ?? '',
    contentType: item.contentType ?? '',
    format: item.format ?? '',
    industry: item.industry ?? '',
    skills: item.skills ?? [],
    styles: item.styles ?? [],
    workflow: (item.workflow ?? []).map((s) => ({ tool: s.tool, version: s.version ?? '', generations: s.generations ?? '', note: s.note ?? '' })),
    versionsCount: item.versionsCount ?? '',
    timeTakenDays: item.timeTakenDays ?? '',
    client: item.licence?.licensedTo ? 'client' : 'personal',
    licensedTo: item.licence?.licensedTo ?? '',
    licenceSummary: item.licence?.summary ?? '',
    briefSummary: item.briefSummary ?? '',
    deliveredSummary: item.deliveredSummary ?? '',
    featured: !!item.featured,
  };
}

const num = (v) => (v === '' || v == null ? null : Number(v));

function toBody(v) {
  return {
    title: v.title,
    description: v.description,
    mediaType: v.mediaType,
    mediaUrl: v.mediaUrl,
    thumbnailUrl: v.thumbnailUrl,
    contentType: v.contentType || null,
    format: v.format || null,
    industry: v.industry || null,
    skills: v.skills,
    styles: v.styles,
    workflow: v.workflow.map((s) => ({ tool: s.tool, version: s.version || undefined, generations: num(s.generations), note: s.note || undefined })),
    versionsCount: num(v.versionsCount),
    timeTakenDays: num(v.timeTakenDays),
    // Personal pieces are "Not for licensing" by default (v9 C3 footer).
    licence: v.client === 'client' ? { licensedTo: v.licensedTo, summary: v.licenceSummary, notForLicensing: false } : { licensedTo: '', summary: '', notForLicensing: true },
    briefSummary: v.briefSummary,
    deliveredSummary: v.deliveredSummary,
    featured: v.featured,
  };
}

function Chips({ options, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <ChipSelect key={o.id} selected={value.includes(o.id)} onClick={() => onChange(value.includes(o.id) ? value.filter((x) => x !== o.id) : [...value, o.id])}>
          {o.label}
        </ChipSelect>
      ))}
    </div>
  );
}

function PiecePanel({ item, onDone, taxonomy }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toForm(item) });
  const { register, handleSubmit, control, formState, setError, watch, setValue, getValues } = form;
  const uploadsOn = useUploadConfig().data?.enabled;
  // The file this form uploaded (and its hash). Sent only while the media link is still that file.
  const uploaded = useRef({ url: '', hash: null });
  const steps = useFieldArray({ control, name: 'workflow' });
  const err = (k) => formState.errors[k]?.message;

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const save = useMutation({
    mutationFn: (values) => {
      const body = { ...toBody(values), ...(uploaded.current.hash && uploaded.current.url === values.mediaUrl ? { contentHash: uploaded.current.hash } : {}) };
      return item ? endpoints.creator.updatePortfolio(item._id, body) : endpoints.creator.addPortfolio(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(item ? 'Piece updated.' : 'Piece published.');
      onDone();
    },
    onError: (e) => applyServerErrors(e, setError),
  });

  const isVideo = watch('mediaType') === 'video';

  const onMedia = async ({ url, file, hash }) => {
    uploaded.current = { url, hash };
    setValue('mediaUrl', url, { shouldValidate: true, shouldDirty: true });
    const video = file.type.startsWith('video/');
    setValue('mediaType', video ? 'video' : 'image');
    // Videos get a still from the first second as their thumbnail, unless one is already set.
    if (video && !getValues('thumbnailUrl')) {
      try {
        const frame = await captureVideoFrame(file);
        if (frame) setValue('thumbnailUrl', await uploadFile(frame, 'thumbnail'), { shouldDirty: true });
      } catch {
        /* the thumbnail is optional */
      }
    }
  };
  const isClient = watch('client') === 'client';

  return (
    <Card as="form" ref={ref} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="scroll-mt-24 border-navy shadow-pop">
      <SectionHead
        as="h3"
        title={item ? 'Edit piece' : 'Add a piece'}
        action={
          <button type="button" onClick={onDone} className="rounded-full p-1.5 text-steel hover:bg-soft hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        }
      />
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-line2 bg-soft p-5 text-center text-slate">
            <Link2 className="size-5" />
            <b>{uploadsOn ? 'Upload your work, or paste a link' : 'Paste a link to your work'}</b>
            <span className="text-[12.5px] text-steel">
              {uploadsOn ? 'Images up to 10 MB, videos up to 200 MB · or a YouTube, Vimeo or Drive link for longer films' : 'YouTube, Vimeo, Drive or an image/video URL · media stays as links'}
            </span>
            {uploadsOn && <UploadButton purpose="portfolio" hash label={isVideo ? 'Upload a video' : 'Upload an image'} onUploaded={onMedia} className="mt-1" />}
            <div className="mt-2 flex w-full flex-col gap-2 text-left">
              <Input aria-label={isVideo ? 'Video link' : 'Image link'} placeholder="https://" error={err('mediaUrl')} {...register('mediaUrl')} />
              <Input
                aria-label="Thumbnail link"
                placeholder={isVideo ? 'Thumbnail link (recommended for video)' : 'Thumbnail link (optional)'}
                error={err('thumbnailUrl')}
                {...register('thumbnailUrl')}
              />
              {uploadsOn && <UploadButton purpose="thumbnail" label="Upload a thumbnail" onUploaded={({ url }) => setValue('thumbnailUrl', url, { shouldDirty: true })} />}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className="sm:col-span-2" label="Title" error={err('title')} {...register('title')} />
            <Select label="Media" {...register('mediaType')}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </Select>
            <Select label="Content type" {...register('contentType')}>
              <option value="">Choose</option>
              {taxonomy.contentTypes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="Format" {...register('format')}>
              <option value="">Choose</option>
              {taxonomy.formats.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="Industry" {...register('industry')}>
              <option value="">Choose</option>
              {taxonomy.specializations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <b>How it was made</b>
          {steps.fields.length === 0 && <p className="text-[12.5px] text-steel">Add the tools in the order you used them — pieces with a workflow rank higher.</p>}
          {steps.fields.map((f, i) => (
            <div key={f.id} className="grid items-start gap-2 sm:grid-cols-[24px_1fr_0.6fr_0.6fr_1fr_auto]">
              <span className="mt-2.5 grid size-6 place-items-center rounded-full bg-navy text-[11px] text-white">{i + 1}</span>
              <Select aria-label={`Step ${i + 1} tool`} error={formState.errors.workflow?.[i]?.tool?.message} {...register(`workflow.${i}.tool`)}>
                <option value="">Tool</option>
                {taxonomy.tools.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input aria-label={`Step ${i + 1} version`} placeholder="Version" {...register(`workflow.${i}.version`)} />
              <Input aria-label={`Step ${i + 1} generations`} placeholder="Gens" type="number" min="0" error={formState.errors.workflow?.[i]?.generations?.message} {...register(`workflow.${i}.generations`)} />
              <Input aria-label={`Step ${i + 1} note`} placeholder="What it did" {...register(`workflow.${i}.note`)} />
              <span className="mt-1.5 flex">
                <button type="button" disabled={i === 0} onClick={() => steps.move(i, i - 1)} className="rounded p-1 text-steel hover:text-ink disabled:opacity-30" aria-label={`Move step ${i + 1} up`}>
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={i === steps.fields.length - 1}
                  onClick={() => steps.move(i, i + 1)}
                  className="rounded p-1 text-steel hover:text-ink disabled:opacity-30"
                  aria-label={`Move step ${i + 1} down`}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button type="button" onClick={() => steps.remove(i)} className="rounded p-1 text-steel hover:text-ink" aria-label={`Remove step ${i + 1}`}>
                  <X className="size-4" />
                </button>
              </span>
            </div>
          ))}
          {steps.fields.length < 12 && (
            <ChipSelect className="self-start" onClick={() => steps.append({ tool: '', version: '', generations: '', note: '' })}>
              <Plus className="size-3.5" /> Add step
            </ChipSelect>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Versions made" type="number" min="1" error={err('versionsCount')} {...register('versionsCount')} />
            <Input label="Time taken (days)" type="number" min="0" error={err('timeTakenDays')} {...register('timeTakenDays')} />
            <Select label="Was this for a client?" {...register('client')}>
              <option value="personal">Personal work — not for licensing</option>
              <option value="client">Yes — licensed to a client</option>
            </Select>
            {isClient && <Input label="Licensed to" placeholder="Client name" error={err('licensedTo')} {...register('licensedTo')} />}
            {isClient && (
              <Input className="sm:col-span-2" label="Licence summary" note="Optional · e.g. Paid ads · India · 6 months" error={err('licenceSummary')} {...register('licenceSummary')} />
            )}
            <Textarea label="Brief asked" note="Optional" rows={2} {...register('briefSummary')} />
            <Textarea label="Delivered" note="Optional" rows={2} {...register('deliveredSummary')} />
          </div>
          <Alert tone="ai">Uploaded files get a duplicate check against other profiles. Links can’t be checked that way, so a reviewer may ask for originals.</Alert>
        </div>
      </div>
      <div className="grid gap-5 border-t border-line p-5 lg:grid-cols-2">
        <Field label="Skills this piece proves" note="Each skill you tick here counts as proof on your profile.">
          <Controller name="skills" control={control} render={({ field }) => <Chips label="Skills" options={taxonomy.skills} value={field.value} onChange={field.onChange} />} />
        </Field>
        <div className="flex flex-col gap-4">
          <Field label="Styles">
            <Controller name="styles" control={control} render={({ field }) => <Chips label="Styles" options={taxonomy.styles} value={field.value} onChange={field.onChange} />} />
          </Field>
          <Textarea label="Description" note="Optional" rows={2} error={err('description')} {...register('description')} />
          <Controller
            name="featured"
            control={control}
            render={({ field }) => <Checkbox label="Feature this piece" description="Featured pieces appear first on your profile." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
          />
        </div>
      </div>
      {save.error && !save.error.details?.length && (
        <div className="px-5 pb-4">
          <Alert tone="error">{save.error.message}</Alert>
        </div>
      )}
      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12.5px] text-steel">Rights: personal pieces show “Not for licensing” by default.</span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {item ? 'Save changes' : 'Publish piece'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DeleteButton({ item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () => endpoints.creator.deletePortfolio(item._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success('Piece deleted.');
    },
  });
  return (
    <ConfirmAction
      title="Delete this piece?"
      body={`“${item.title}” will be removed from your public profile. The media file itself stays wherever it’s hosted.`}
      confirmLabel="Delete"
      variant="danger"
      pending={del.isPending}
      error={del.error}
      onConfirm={() => del.mutateAsync()}
      trigger={(open) => (
        <button type="button" onClick={open} className="rounded-full p-1.5 text-steel hover:bg-soft hover:text-att" aria-label={`Delete ${item.title}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    />
  );
}

export default function CreatorPortfolio() {
  useDocumentTitle('Portfolio');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const { data: taxonomy, error: taxonomyError } = useTaxonomy();
  const query = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const verifications = useQuery({ queryKey: ['mine', 'verifications'], queryFn: endpoints.creator.verifications });
  const statusFor = (id) => verifications.data?.find((v) => v.portfolioItemId === id)?.status;
  const count = query.data?.length;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={count != null ? `Portfolio · ${count}` : 'Portfolio'}
        description="Pieces with a workflow rank higher and get a “How it was made” panel."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add piece
          </Button>
        }
      />
      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-[4/6]" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : count === 0 ? (
        <EmptyState icon={ImagePlus} title="Your portfolio is empty" action={<Button onClick={() => setEditing('new')}>Add your first piece</Button>}>
          Paste links to your work and show how each piece was made — tools, generations and versions.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {query.data.map((item) => {
            const hasWorkflow = item.workflow?.length > 0;
            const status = statusFor(item._id);
            return (
              <li key={item._id} className="flex flex-col overflow-hidden rounded-md border border-line bg-white">
                <MediaFrame item={item} aspect="aspect-[4/5]" className="rounded-none" showLabel={false} />
                <div className="flex flex-1 flex-col gap-1.5 p-2.5 text-[13px]">
                  <b className="flex items-start gap-1">
                    {item.featured && <Star className="mt-0.5 size-3.5 shrink-0 fill-navy text-navy" aria-label="Featured" />}
                    <span className="line-clamp-2">{item.title}</span>
                  </b>
                  <div className="flex flex-wrap gap-1.5">
                    {item.madeOnUnio && <MadeOnUnio count={1} />}
                    {hasWorkflow ? (
                      <Pill tone="ok">Workflow added</Pill>
                    ) : (
                      <button type="button" onClick={() => setEditing(item)}>
                        <Pill tone="wait">Add workflow</Pill>
                      </button>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                    {status !== 'VERIFIED' ? (
                      <Link to={`/creator/verification?portfolio=${item._id}`} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-navy hover:underline">
                        <ShieldCheck className="size-3.5" /> {status ? 'Evidence' : 'Verify'}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                        <ShieldCheck className="size-3.5" /> Verified
                      </span>
                    )}
                    <span className="flex">
                      <button type="button" onClick={() => setEditing(item)} className="rounded-full p-1.5 text-steel hover:bg-soft hover:text-ink" aria-label={`Edit ${item.title}`}>
                        <Pencil className="size-4" />
                      </button>
                      <DeleteButton item={item} />
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && taxonomy && (
        <PiecePanel key={editing === 'new' ? 'new' : editing._id} item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} taxonomy={taxonomy} />
      )}
      {editing && taxonomyError && <ErrorState error={taxonomyError} />}
    </>
  );
}
