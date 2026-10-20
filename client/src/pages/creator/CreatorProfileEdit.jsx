import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { CreatorCard, toolStateFor } from '../../components/creators/CreatorCard.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { ChipSelect, Field, Input, Select, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { ToolChip } from '../../components/ui/Trust.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { endpoints } from '../../services/api.js';

/* v9 C2 — edit profile with a live preview of the real card. Trust states are read-only (server-computed). */

const optionalUrl = z.union([z.literal(''), z.string().trim().url('Enter a full URL starting with https://')]);
const optNum = (min, max, msg) => z.union([z.literal(''), z.coerce.number().min(min, msg).max(max, msg)]);

const schema = z.object({
  displayName: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  location: z.string().trim().max(120),
  headline: z.string().trim().max(140, 'Keep it under 140 characters'),
  bio: z.string().trim().max(2000, 'Keep it under 2000 characters'),
  photoUrl: optionalUrl,
  category: z.string(),
  secondaryCategories: z.array(z.string()).max(2, 'Up to 2'),
  contentTypes: z.array(z.string()),
  specializations: z.array(z.string()),
  styles: z.array(z.string()),
  formats: z.array(z.string()),
  languages: z.array(z.string()),
  skills: z.array(z.string()),
  tools: z.array(z.string()),
  workflow: z.array(z.string()).max(8),
  howIWork: z.array(z.object({ title: z.string().trim().min(2, 'Name the step').max(60), detail: z.string().trim().max(160) })).max(6),
  startingPrice: optNum(0, 100_000_000, 'Enter a price in rupees'),
  turnaroundDays: z.string(),
  revisionsIncluded: optNum(0, 10, '0–10'),
  commerciallySafe: z.enum(['yes', 'no']),
  availability: z.enum(['available', 'busy', 'unavailable']),
});

const TURNAROUND = [1, 2, 3, 5, 7, 10, 14, 21, 30];

function toForm(p, knownSkills) {
  return {
    displayName: p.displayName ?? '',
    location: p.location ?? '',
    headline: p.headline ?? '',
    bio: p.bio ?? '',
    photoUrl: p.photoUrl ?? '',
    category: p.category ?? '',
    secondaryCategories: p.secondaryCategories ?? [],
    contentTypes: p.contentTypes ?? [],
    specializations: p.specializations ?? [],
    styles: p.styles ?? [],
    formats: p.formats ?? [],
    languages: p.languages ?? [],
    // Round 1 free-text skills aren't on the list; they're listed in a notice instead of the form.
    skills: (p.skills ?? []).filter((s) => !knownSkills || knownSkills.has(s)),
    tools: p.tools ?? [],
    workflow: p.workflow ?? [],
    howIWork: (p.howIWork ?? []).map((s) => ({ title: s.title, detail: s.detail ?? '' })),
    startingPrice: p.startingPrice ?? '',
    turnaroundDays: p.turnaroundDays ? String(p.turnaroundDays) : '',
    revisionsIncluded: p.revisionsIncluded ?? 2,
    commerciallySafe: p.commerciallySafe ? 'yes' : 'no',
    availability: p.availability ?? 'available',
  };
}

function toBody(v) {
  return {
    ...v,
    category: v.category || undefined,
    startingPrice: v.startingPrice === '' ? null : Number(v.startingPrice),
    turnaroundDays: v.turnaroundDays ? Number(v.turnaroundDays) : null,
    revisionsIncluded: v.revisionsIncluded === '' ? null : Number(v.revisionsIncluded),
    commerciallySafe: v.commerciallySafe === 'yes',
  };
}

/** Multi-select chips from a taxonomy list. `counts` shows a green proof badge (skills). */
function ChipField({ label, note, options, value, onChange, max, counts, error }) {
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (!max || value.length < max) onChange([...value, id]);
  };
  return (
    <Field label={label} note={note} error={error}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const n = counts?.[o.id];
          return (
            <ChipSelect key={o.id} selected={value.includes(o.id)} onClick={() => toggle(o.id)}>
              {o.label}
              {n > 0 && <span className="ml-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ok px-[5px] text-[10px] text-white">{n}</span>}
            </ChipSelect>
          );
        })}
      </div>
    </Field>
  );
}

function SectionCard({ title, note, action, children }) {
  return (
    <Card pad className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[16px]">{title}</h3>
          {note && <p className="text-[12.5px] text-steel">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const PROOF = { verified: 'Verified by a UNIO reviewer', certified: 'Certificate checked', pending: 'Evidence sent · review pending', self: 'Self-reported — counts half in matching' };

export default function CreatorProfileEdit() {
  useDocumentTitle('Edit profile');
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const { data: taxonomy, error: taxonomyError } = useTaxonomy();
  const profile = useQuery({ queryKey: ['mine', 'creator-profile'], queryFn: endpoints.creator.profile });
  const portfolio = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const knownSkills = useMemo(() => (taxonomy ? new Set(taxonomy.skills.map((s) => s.id)) : null), [taxonomy]);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: toForm({}) });
  const { register, handleSubmit, control, reset, formState, setError, watch, setValue } = form;
  const steps = useFieldArray({ control, name: 'howIWork' });

  useEffect(() => {
    if (profile.data && knownSkills) reset(toForm(profile.data, knownSkills));
  }, [profile.data, knownSkills, reset]);

  const save = useMutation({
    mutationFn: ({ values }) => endpoints.creator.updateProfile(toBody(values)),
    onSuccess: (data, { view }) => {
      qc.setQueryData(['mine', 'creator-profile'], data);
      qc.invalidateQueries({ queryKey: ['pub'] });
      refresh();
      reset(toForm(data, knownSkills));
      toast.success('Profile saved.');
      if (view) navigate(`/creators/${data._id}`);
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  if (profile.isLoading || (!taxonomy && !taxonomyError)) return <PageLoader label="Loading your profile" />;
  if (profile.error || taxonomyError) return <ErrorState error={profile.error ?? taxonomyError} onRetry={profile.refetch} />;

  const values = watch();
  const p = profile.data;
  const legacySkills = (p.skills ?? []).filter((s) => !knownSkills.has(s));
  const preview = {
    ...p,
    ...toBody(values),
    _id: p._id,
    portfolioPreview: portfolio.data ?? [],
  };
  const err = (k) => formState.errors[k]?.message;
  const addable = (taxonomy.tools ?? []).filter((t) => !values.tools.includes(t.id));
  const submit = (view) => handleSubmit((v) => save.mutate({ values: v, view }));
  const move = (i, d) => {
    const next = [...values.workflow];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setValue('workflow', next, { shouldDirty: true });
  };

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-col gap-[22px]">
      <PageHeader
        eyebrow="Account"
        title="Edit profile"
        description="Brands see the card on the right first. Make every part count."
        actions={
          <Button onClick={submit(true)} loading={save.isPending && save.variables?.view}>
            Save &amp; view
          </Button>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="Basics">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input label="Display name" error={err('displayName')} {...register('displayName')} />
              <Input label="City" autoComplete="address-level2" error={err('location')} {...register('location')} />
              <Input className="sm:col-span-2" label="Headline" placeholder="e.g. AI product ads for beauty & D2C · 9:16 first" error={err('headline')} {...register('headline')} />
              <Textarea className="sm:col-span-2" label="About" rows={3} error={err('bio')} {...register('bio')} />
              <Input className="sm:col-span-2" label="Photo URL" note="Optional · initials show until you add one" placeholder="https://" error={err('photoUrl')} {...register('photoUrl')} />
            </div>
          </SectionCard>

          <SectionCard title="What you make" note="Brands filter on every field here. Pick from the lists — the more accurate, the better your matches.">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Select label="Main category" note="One — this is how brands find you first" error={err('category')} {...register('category')}>
                <option value="">Choose one</option>
                {taxonomy.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label.replace(/s$/, '')}
                  </option>
                ))}
              </Select>
              <Controller
                name="secondaryCategories"
                control={control}
                render={({ field }) => {
                  const label = (id) => taxonomy.categories.find((c) => c.id === id)?.label.replace(/s$/, '') ?? id;
                  const choices = taxonomy.categories.filter((c) => c.id !== values.category && !field.value.includes(c.id));
                  return (
                    <Field label="Also do" note="Up to 2 more categories" error={err('secondaryCategories')}>
                      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-[#9aa5aa] bg-white px-2 py-1.5">
                        {field.value.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-navy py-0.5 pl-2.5 pr-1 text-[12.5px] font-semibold text-white">
                            {label(id)}
                            <button type="button" onClick={() => field.onChange(field.value.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-white/15" aria-label={`Remove ${label(id)}`}>
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                        {field.value.length < 2 && (
                          <select
                            aria-label="Add a category"
                            value=""
                            onChange={(e) => e.target.value && field.onChange([...field.value, e.target.value])}
                            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[13px] font-semibold text-steel outline-none"
                          >
                            <option value="">+ Add</option>
                            {choices.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label.replace(/s$/, '')}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </Field>
                  );
                }}
              />
            </div>
            {[
              ['contentTypes', 'Content types you deliver', 'contentTypes'],
              ['specializations', 'Specializations (industries)', 'specializations'],
              ['styles', 'Styles', 'styles'],
            ].map(([name, label, list]) => (
              <Controller
                key={name}
                name={name}
                control={control}
                render={({ field }) => <ChipField label={label} options={taxonomy[list]} value={field.value} onChange={field.onChange} error={err(name)} />}
              />
            ))}
            {legacySkills.length > 0 && (
              <Alert tone="warning" title="Your earlier skills aren’t on the new list">
                {legacySkills.join(', ')} — pick the matching skills below. Old entries stay hidden from brands.
              </Alert>
            )}
            <Controller
              name="skills"
              control={control}
              render={({ field }) => (
                <ChipField
                  label="Skills"
                  note="Each skill shows how many of your pieces prove it. Skills with 0 pieces are hidden from brands — add a piece to show it."
                  options={taxonomy.skills}
                  counts={p.skillProof}
                  value={field.value}
                  onChange={field.onChange}
                  error={err('skills')}
                />
              )}
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Controller name="formats" control={control} render={({ field }) => <ChipField label="Formats" options={taxonomy.formats} value={field.value} onChange={field.onChange} />} />
              <Controller name="languages" control={control} render={({ field }) => <ChipField label="Languages" options={taxonomy.languages} value={field.value} onChange={field.onChange} />} />
              <Select label="Turnaround" {...register('turnaroundDays')}>
                <option value="">Not set</option>
                {[...new Set([...TURNAROUND, Number(values.turnaroundDays) || 0])].filter(Boolean).sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? '1 day' : `${d} days`}
                  </option>
                ))}
              </Select>
            </div>
          </SectionCard>

          <SectionCard
            title="Tools"
            action={
              <Link to="/creator/verification" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy">
                Verify tools <ArrowRight className="size-3" />
              </Link>
            }
          >
            <Controller
              name="tools"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {field.value.map((t) => {
                    const state = toolStateFor(p, t);
                    return (
                      <div key={t} className="flex flex-wrap items-center gap-2.5 rounded-md border border-[#edf0ef] bg-soft px-3 py-2.5">
                        <ToolChip name={t} state={state} />
                        <span className="min-w-0 flex-1 text-[12.5px] text-steel">{PROOF[state]}</span>
                        {state === 'self' && (
                          <ButtonLink to="/creator/verification" variant="secondary" size="sm">
                            Verify
                          </ButtonLink>
                        )}
                        <button type="button" onClick={() => field.onChange(field.value.filter((x) => x !== t))} className="rounded-full p-1 text-steel hover:bg-line hover:text-ink" aria-label={`Remove ${t}`}>
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                  {addable.length > 0 && (
                    <select
                      aria-label="Add tool"
                      value=""
                      onChange={(e) => e.target.value && field.onChange([...field.value, e.target.value])}
                      className="h-[34px] self-start rounded-full border border-line2 bg-white px-3 text-[13px] font-semibold text-slate"
                    >
                      <option value="">+ Add tool</option>
                      {addable.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            />
          </SectionCard>

          <SectionCard title="Default workflow" note="Shown on your card, in order. Use the arrows to reorder.">
            <div className="flex flex-wrap items-center gap-1.5">
              {values.workflow.map((t, i) => (
                <span key={`${t}-${i}`} className="contents">
                  {i > 0 && <em className="not-italic text-mist" aria-hidden>→</em>}
                  <span className="inline-flex items-center gap-1 rounded-md border border-line2 bg-white py-1.5 pl-3 pr-1.5 text-[13px] font-semibold">
                    {t}
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-0.5 text-steel hover:text-ink disabled:opacity-30" aria-label={`Move ${t} earlier`}>
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <button type="button" disabled={i === values.workflow.length - 1} onClick={() => move(i, 1)} className="rounded p-0.5 text-steel hover:text-ink disabled:opacity-30" aria-label={`Move ${t} later`}>
                      <ArrowRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('workflow', values.workflow.filter((_, j) => j !== i), { shouldDirty: true })}
                      className="rounded p-0.5 text-steel hover:text-ink"
                      aria-label={`Remove ${t} from workflow`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                </span>
              ))}
              {values.workflow.length < 8 && (
                <select
                  aria-label="Add workflow step"
                  value=""
                  onChange={(e) => e.target.value && setValue('workflow', [...values.workflow, e.target.value], { shouldDirty: true })}
                  className="h-[34px] rounded-md border border-dashed border-line2 bg-white px-2 text-[13px] font-semibold text-steel"
                >
                  <option value="">+ Step</option>
                  {taxonomy.tools.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="How I work"
            note="Up to 6 steps, shown on your profile."
            action={
              steps.fields.length < 6 && (
                <Button size="sm" variant="secondary" onClick={() => steps.append({ title: '', detail: '' })}>
                  <Plus className="size-4" /> Add step
                </Button>
              )
            }
          >
            {steps.fields.length === 0 && <p className="text-[12.5px] text-steel">No steps yet — e.g. Brief call → Moodboard → Generate → Edit → Deliver.</p>}
            {steps.fields.map((f, i) => (
              <div key={f.id} className="grid items-start gap-2 sm:grid-cols-[24px_1fr_1.4fr_32px]">
                <span className="mt-2.5 grid size-6 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
                <Input aria-label={`Step ${i + 1} name`} placeholder="Step" error={formState.errors.howIWork?.[i]?.title?.message} {...register(`howIWork.${i}.title`)} />
                <Input aria-label={`Step ${i + 1} detail`} placeholder="What happens" {...register(`howIWork.${i}.detail`)} />
                <button type="button" onClick={() => steps.remove(i)} className="mt-2 rounded-full p-1.5 text-steel hover:bg-line hover:text-ink" aria-label={`Remove step ${i + 1}`}>
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Pricing & availability">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input label="Starting price / piece" type="number" min="0" prefix="₹" error={err('startingPrice')} {...register('startingPrice')} />
              <Input label="Revisions included" type="number" min="0" max="10" error={err('revisionsIncluded')} {...register('revisionsIncluded')} />
              <Select label="Status" {...register('availability')}>
                <option value="available">Available</option>
                <option value="busy">Busy — limited availability</option>
                <option value="unavailable">Not taking work</option>
              </Select>
              <Select label="Commercially-safe tools only" {...register('commerciallySafe')}>
                <option value="yes">Yes, I can deliver this</option>
                <option value="no">Not always</option>
              </Select>
            </div>
          </SectionCard>

          {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
          {formState.isDirty && (
            <div className="sticky bottom-20 z-20 flex items-center justify-end gap-3 rounded-lg border border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur lg:bottom-4">
              <span className="mr-auto text-[12.5px] text-steel">Unsaved changes</span>
              <Button variant="ghost" size="sm" onClick={() => reset(toForm(p, knownSkills))}>
                Discard
              </Button>
              <Button type="submit" size="sm" loading={save.isPending && !save.variables?.view}>
                Save
              </Button>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-[84px]">
          <span className="eyebrow">Live preview · your card</span>
          <CreatorCard creator={preview} preview />
          <Card pad className="flex flex-col gap-1.5 text-[12.5px]">
            <b>The 8 parts of your card</b>
            {['Typed thumbnail', 'Name, city, availability', 'Rating or match', 'Headline skill', 'Tools with trust state', 'Workflow chain', 'Starting price', 'Trust level'].map((t, i) => (
              <span key={t} className="text-steel">
                <span className="font-mono">{i + 1}</span> · {t}
              </span>
            ))}
          </Card>
        </aside>
      </div>
    </form>
  );
}
