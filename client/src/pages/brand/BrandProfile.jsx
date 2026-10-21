import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { BriefCard } from '../../components/campaigns/BriefCard.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Pill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, SectionHead } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, Select, TagInput, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { endpoints } from '../../services/api.js';

/* v9 B8 — brand profile + brand kit. The kit is sent to the brief builder as context; creators see the colours on briefs. */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const optionalUrl = z.union([z.literal(''), z.string().trim().url('Enter a full URL starting with https://')]);
const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter at least 2 characters').max(160),
  accountType: z.enum(['brand', 'agency']),
  industry: z.string(),
  websiteUrl: optionalUrl,
  description: z.string().trim().max(2000),
  colors: z.array(z.object({ name: z.string().trim().max(40), hex: z.string().trim().regex(HEX, 'Use a hex colour like #8a3b2e') })).max(8),
  headingFont: z.string().trim().max(60),
  bodyFont: z.string().trim().max(60),
  tone: z.array(z.string()).max(6),
  neverDo: z.string().trim().max(500),
  assetUrls: z.array(z.string()).max(12),
});

const toForm = (p) => ({
  companyName: p.companyName ?? '',
  accountType: p.accountType ?? 'brand',
  industry: p.industry ?? '',
  websiteUrl: p.websiteUrl ?? '',
  description: p.description ?? '',
  colors: p.brandKit?.colors?.map(({ name, hex }) => ({ name: name ?? '', hex })) ?? [],
  headingFont: p.brandKit?.headingFont ?? '',
  bodyFont: p.brandKit?.bodyFont ?? '',
  tone: p.brandKit?.tone ?? [],
  neverDo: p.brandKit?.neverDo ?? '',
  assetUrls: p.brandKit?.assetUrls ?? [],
});

const toBody = (v, industryIds) => ({
  companyName: v.companyName,
  accountType: v.accountType,
  // Round 1 profiles may hold free-text industries; only taxonomy ids are sent back.
  ...(industryIds.includes(v.industry) ? { industry: v.industry } : {}),
  websiteUrl: v.websiteUrl,
  description: v.description,
  brandKit: {
    colors: v.colors.map((c) => ({ ...(c.name ? { name: c.name } : {}), hex: c.hex })),
    headingFont: v.headingFont,
    bodyFont: v.bodyFont,
    tone: v.tone,
    neverDo: v.neverDo,
    assetUrls: v.assetUrls,
  },
});

function KitLabel({ children, htmlFor }) {
  const As = htmlFor ? 'label' : 'p';
  return (
    <As {...(htmlFor ? { htmlFor } : {})} className="mb-2.5 block font-mono text-[10.5px] uppercase tracking-[0.16em] text-steel">
      {children}
    </As>
  );
}

function AssetThumb({ url, onRemove }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="group relative size-14 overflow-hidden rounded-[8px] border border-line bg-soft">
      {broken ? (
        <span className="grid size-full place-items-center text-steel" title={url}>
          <ImageOff className="size-4" />
        </span>
      ) : (
        <img src={url} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-ink/80 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
        aria-label="Remove asset"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function AssetUrls({ value, onChange }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const url = draft.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return setError('Paste a full image URL starting with https://');
    if (value.includes(url)) return setError('That asset is already in the kit.');
    onChange([...value, url]);
    setDraft('');
    setError('');
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((u) => (
          <AssetThumb key={u} url={u} onRemove={() => onChange(value.filter((x) => x !== u))} />
        ))}
        {value.length < 12 && (
          <div className="flex min-w-[220px] flex-1 items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Paste an image URL (logo, pattern, product)"
              aria-label="Asset image URL"
              className="h-14 min-w-0 flex-1 rounded-[8px] border border-dashed border-line2 bg-white px-3 text-[13px] outline-none focus:border-navy"
            />
            <Button variant="secondary" size="sm" onClick={add} aria-label="Add asset">
              <Plus className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-[12.5px] font-medium text-att">{error}</p>}
    </>
  );
}

export default function BrandProfile() {
  useDocumentTitle('Brand profile');
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const uid = useId();
  const { data: taxonomy } = useTaxonomy();
  const profile = useQuery({ queryKey: ['mine', 'brand-profile'], queryFn: endpoints.brand.profile });
  const latest = useQuery({ queryKey: ['mine', 'brand-campaigns', { latest: true }], queryFn: () => endpoints.brand.campaigns({ status: 'open', limit: 1 }) });
  const { register, handleSubmit, reset, formState, setError, control, watch } = useForm({ resolver: zodResolver(schema), defaultValues: toForm({}) });
  const colors = useFieldArray({ control, name: 'colors' });

  useEffect(() => {
    if (profile.data) reset(toForm(profile.data));
  }, [profile.data, reset]);

  const industryIds = (taxonomy?.specializations ?? []).map((s) => s.id);
  const save = useMutation({
    mutationFn: (v) => endpoints.brand.updateProfile(toBody(v, industryIds)),
    onSuccess: (data) => {
      qc.setQueryData(['mine', 'brand-profile'], data);
      qc.invalidateQueries({ queryKey: ['pub'] });
      refresh();
      reset(toForm(data));
      toast.success('Brand profile saved.');
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  if (profile.isLoading) return <PageLoader />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  const v = watch();
  const hasKit = v.colors.length > 0 || v.tone.length > 0 || v.headingFont || v.neverDo || v.assetUrls.length > 0;
  const sample = latest.data?.items?.[0];
  const preview = sample && {
    ...sample,
    brand: {
      companyName: v.companyName || profile.data.companyName,
      industry: v.industry,
      accountType: v.accountType,
      kitColors: v.colors.filter((c) => HEX.test(c.hex)),
    },
  };
  const kitErr = formState.errors;

  return (
    <>
      <PageHeader eyebrow="Account" title="Brand profile" description="Creators see this on every brief. The brand kit is attached to new briefs automatically." />
      <form onSubmit={handleSubmit((vals) => save.mutate(vals))} noValidate className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]">
        <div className="min-w-0 space-y-5">
          <Card pad className="grid gap-4 sm:grid-cols-2">
            <Input label="Brand name" required error={kitErr.companyName?.message} {...register('companyName')} />
            <Select label="Account type" {...register('accountType')}>
              <option value="brand">Brand</option>
              <option value="agency">Agency</option>
            </Select>
            <Select label="Industry" error={kitErr.industry?.message} {...register('industry')}>
              <option value="">Choose…</option>
              {taxonomy?.specializations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input label="Website" placeholder="https://" error={kitErr.websiteUrl?.message} {...register('websiteUrl')} />
            <Textarea className="sm:col-span-2" label="About" rows={3} error={kitErr.description?.message} {...register('description')} />
          </Card>

          <Card>
            <SectionHead title="Brand kit" action={hasKit ? <Pill tone="ok">Attached to briefs</Pill> : <Pill>Not set</Pill>} />
            <div className="space-y-6 p-5">
              <div>
                <KitLabel>Colours</KitLabel>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {colors.fields.map((field, i) => {
                    const hex = v.colors[i]?.hex ?? '';
                    const ok = HEX.test(hex);
                    return (
                      <div key={field.id} className="group relative min-w-0">
                        <label className="block h-14 cursor-pointer overflow-hidden rounded-[8px] border border-black/10" style={{ background: ok ? hex : 'var(--color-soft)' }}>
                          <input
                            type="color"
                            className="size-full cursor-pointer opacity-0"
                            value={ok && hex.length === 7 ? hex : '#000000'}
                            onChange={(e) => colors.update(i, { ...v.colors[i], hex: e.target.value })}
                            aria-label={`Pick colour ${i + 1}`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => colors.remove(i)}
                          className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                          aria-label={`Remove colour ${i + 1}`}
                        >
                          <X className="size-3" />
                        </button>
                        <input
                          placeholder="Name"
                          aria-label={`Colour ${i + 1} name`}
                          className="mt-2 w-full bg-transparent text-[15px] font-bold outline-none placeholder:font-normal placeholder:text-mist"
                          {...register(`colors.${i}.name`)}
                        />
                        <input
                          aria-label={`Colour ${i + 1} hex`}
                          aria-invalid={!!kitErr.colors?.[i]?.hex}
                          className={`w-full bg-transparent font-mono text-[12px] outline-none ${kitErr.colors?.[i]?.hex ? 'text-att' : 'text-steel'}`}
                          {...register(`colors.${i}.hex`)}
                        />
                      </div>
                    );
                  })}
                  {colors.fields.length < 8 && colors.fields.length % 4 !== 0 && (
                    <button
                      type="button"
                      onClick={() => colors.append({ name: '', hex: '#4a5c6a' })}
                      className="grid h-14 place-items-center rounded-[8px] border border-dashed border-line2 text-steel hover:border-navy hover:text-navy"
                      aria-label="Add colour"
                    >
                      <Plus className="size-4" />
                    </button>
                  )}
                </div>
                {colors.fields.length < 8 && colors.fields.length % 4 === 0 && (
                  <button type="button" onClick={() => colors.append({ name: '', hex: '#4a5c6a' })} className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-navy hover:underline">
                    <Plus className="size-3.5" /> Add colour
                  </button>
                )}
                {kitErr.colors && <p className="mt-1.5 text-[12.5px] font-medium text-att">Use hex colours like #8a3b2e.</p>}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <KitLabel>Fonts</KitLabel>
                  <div className="space-y-1.5 text-[15px]">
                    <label className="flex items-baseline gap-1.5">
                      <b className="shrink-0">Headings:</b>
                      <input placeholder="e.g. Playfair" className="min-w-0 flex-1 border-b border-transparent bg-transparent outline-none placeholder:text-mist focus:border-navy" {...register('headingFont')} />
                    </label>
                    <label className="flex items-baseline gap-1.5">
                      <b className="shrink-0">Body:</b>
                      <input placeholder="e.g. Manrope" className="min-w-0 flex-1 border-b border-transparent bg-transparent outline-none placeholder:text-mist focus:border-navy" {...register('bodyFont')} />
                    </label>
                  </div>
                </div>
                <div>
                  <KitLabel>Tone</KitLabel>
                  <Controller
                    name="tone"
                    control={control}
                    render={({ field }) => (
                      <TagInput value={field.value} onChange={field.onChange} max={6} placeholder="Add a tone word" suggestions={field.value.length < 3 ? ['Warm', 'Homely', 'Playful', 'Premium', 'Bold', 'Minimal', 'Regional', 'Witty'] : []} />
                    )}
                  />
                </div>
              </div>

              <div>
                <KitLabel htmlFor={`${uid}-never`}>Never do</KitLabel>
                <textarea
                  id={`${uid}-never`}
                  rows={2}
                  maxLength={500}
                  placeholder="e.g. No health claims · No alcohol · No real-person likeness without consent"
                  className="w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none placeholder:text-mist focus:border-navy"
                  {...register('neverDo')}
                />
              </div>

              <div>
                <KitLabel>Assets</KitLabel>
                <Controller name="assetUrls" control={control} render={({ field }) => <AssetUrls value={field.value} onChange={field.onChange} />} />
              </div>
            </div>
          </Card>

          {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => reset(toForm(profile.data))} disabled={!formState.isDirty}>
              Discard
            </Button>
            <Button type="submit" loading={save.isPending} disabled={!formState.isDirty}>
              Save profile
            </Button>
          </div>
        </div>

        <aside className="space-y-3.5 lg:sticky lg:top-24">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-steel">What creators see</p>
          {preview ? (
            <BriefCard campaign={preview} preview />
          ) : (
            <Card pad className="text-[14px] text-steel">
              Publish a brief and a preview of how creators see it appears here.
            </Card>
          )}
          <div className="flex gap-2 rounded-lg border border-ai-ln bg-ai-bg px-4 py-3 text-[13.5px] text-[#24346e]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>The AI brief builder reads your kit and tone, so new briefs start on-brand.</p>
          </div>
        </aside>
      </form>
    </>
  );
}
