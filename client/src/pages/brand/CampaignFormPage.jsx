import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, FileText, Paperclip, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { z } from 'zod';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { AiMark, Pill } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { ChipSelect, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { BRIEF_FIELDS, filledCount } from '../../lib/brief.js';
import { safeReturnTo } from '../../lib/returnTo.js';
import { rightsMissing } from '../../lib/rights.js';
import { endpoints } from '../../services/api.js';

/*
 * v9 B3 — AI brief builder. One line in, a structured brief out. Drafts only fill the form;
 * nothing is saved until the brand clicks Save draft or Publish. AI-filled fields stay tinted
 * until the brand edits them. Publishing needs the four rights answers (F7).
 */

const money = z.union([z.literal(''), z.coerce.number().min(0, 'Must be 0 or more').max(100_000_000)]);

const schema = z
  .object({
    title: z.string().trim().min(4, 'Use at least 4 characters').max(160),
    category: z.string().min(1, 'Choose an industry'),
    clientId: z.string(),
    brief: z.string().trim().min(20, 'Describe the brief in at least 20 characters').max(5000),
    contentType: z.string(),
    formats: z.array(z.string()),
    lengthNote: z.string().trim().max(80),
    style: z.string().trim().max(300),
    languages: z.array(z.string()),
    budgetMin: money,
    budgetMax: money,
    deadline: z.string().optional(),
    requiredSkills: z.array(z.string()).max(30),
    requiredTools: z.array(z.string()).max(20),
    deliverables: z
      .array(z.object({ title: z.string().trim().max(160), description: z.string().trim().max(1000).optional(), quantity: z.coerce.number().int().min(1, 'At least 1').max(100) }))
      .max(20),
    revisionsIncluded: z.coerce.number().int().min(0).max(5),
    rights: z.any(),
    sourcePortfolioItemId: z.string().optional(),
    status: z.string(),
  })
  .refine((v) => v.budgetMin === '' || v.budgetMax === '' || Number(v.budgetMax) >= Number(v.budgetMin), {
    path: ['budgetMax'],
    message: 'Maximum must be at least the minimum',
  });

const EMPTY_RIGHTS = {
  usage: [],
  region: null,
  regionNote: '',
  durationMonths: null,
  exclusive: null,
  portfolioAllowed: 'after_launch',
  commerciallySafeTools: true,
  aiLabel: true,
  likeness: 'none',
};

const EMPTY = {
  title: '',
  category: '',
  clientId: '',
  brief: '',
  contentType: '',
  formats: [],
  lengthNote: '',
  style: '',
  languages: [],
  budgetMin: '',
  budgetMax: '',
  deadline: '',
  requiredSkills: [],
  requiredTools: [],
  deliverables: [{ title: '', description: '', quantity: 1 }],
  revisionsIncluded: 2,
  rights: EMPTY_RIGHTS,
  sourcePortfolioItemId: '',
  status: 'draft',
};

const day = (d) => (d ? String(d).slice(0, 10) : '');

function toForm(c) {
  return {
    ...EMPTY,
    title: c.title ?? '',
    category: c.category ?? '',
    clientId: c.clientId ?? '',
    brief: c.brief ?? '',
    contentType: c.contentType ?? '',
    formats: c.formats ?? [],
    lengthNote: c.lengthNote ?? '',
    style: c.style ?? '',
    languages: c.languages ?? [],
    budgetMin: c.budgetMin ?? '',
    budgetMax: c.budgetMax ?? '',
    deadline: day(c.deadline),
    requiredSkills: c.requiredSkills ?? [],
    requiredTools: c.requiredTools ?? [],
    deliverables: c.deliverables?.length ? c.deliverables.map((d) => ({ description: '', ...d })) : EMPTY.deliverables,
    revisionsIncluded: c.revisionsIncluded ?? 2,
    rights: { ...EMPTY_RIGHTS, ...(c.rights ?? {}) },
    sourcePortfolioItemId: c.sourcePortfolioItemId ?? '',
    status: c.status ?? 'draft',
  };
}

function toBody(v, aiFields) {
  const { regionNote, ...rights } = v.rights ?? EMPTY_RIGHTS;
  return {
    title: v.title,
    category: v.category,
    clientId: v.clientId || undefined,
    brief: v.brief,
    contentType: v.contentType || null,
    formats: v.formats,
    lengthNote: v.lengthNote,
    style: v.style,
    languages: v.languages,
    budgetMin: v.budgetMin === '' ? null : Number(v.budgetMin),
    budgetMax: v.budgetMax === '' ? null : Number(v.budgetMax),
    deadline: v.deadline ? new Date(`${v.deadline}T00:00:00.000Z`).toISOString() : null,
    requiredSkills: v.requiredSkills,
    requiredTools: v.requiredTools,
    deliverables: v.deliverables
      .filter((d) => d.title?.trim())
      .map((d) => ({ title: d.title.trim(), description: d.description?.trim() ?? '', quantity: Number(d.quantity) || 1 })),
    revisionsIncluded: Number(v.revisionsIncluded),
    rights: { ...rights, ...(rights.region === 'custom' && regionNote?.trim() ? { regionNote: regionNote.trim() } : {}) },
    sourcePortfolioItemId: v.sourcePortfolioItemId || null,
    aiFilledFields: aiFields ? [...aiFields] : [],
    status: v.status,
  };
}

/** Draft fields from POST /brand/briefs/draft → form values. */
function draftToForm(fields, current) {
  return {
    ...current,
    title: fields.title ?? '',
    category: fields.category ?? current.category,
    brief: fields.brief ?? '',
    contentType: fields.contentType ?? '',
    formats: fields.formats ?? [],
    lengthNote: fields.lengthNote ?? '',
    style: fields.style ?? '',
    languages: fields.languages ?? [],
    budgetMin: fields.budgetMin ?? '',
    budgetMax: fields.budgetMax ?? '',
    deadline: day(fields.deadline),
    requiredSkills: fields.requiredSkills ?? [],
    requiredTools: fields.requiredTools ?? [],
    deliverables: fields.deliverables?.length ? fields.deliverables.map((d) => ({ description: '', quantity: 1, ...d })) : EMPTY.deliverables,
    revisionsIncluded: fields.revisionsIncluded ?? current.revisionsIncluded,
    rights: { ...EMPTY_RIGHTS, ...Object.fromEntries(Object.entries(fields.rights ?? {}).filter(([, v]) => v !== undefined)) },
    sourcePortfolioItemId: fields.sourcePortfolioItemId ?? current.sourcePortfolioItemId,
  };
}

const bare = 'w-full min-w-0 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-mist';

/** One field of the live brief (v9 .bf). AI-filled tiles are tinted until edited. */
function Tile({ label, ai, error, htmlFor, onEdit, className = '', children }) {
  const Label = htmlFor ? 'label' : 'p';
  return (
    <div
      onChangeCapture={onEdit}
      className={`rounded-md border px-3.5 py-3 transition-colors focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/10 ${
        error ? 'border-att-ln bg-white' : ai ? 'border-ai-ln bg-ai-bg/60' : 'border-line bg-white'
      } ${className}`}
    >
      <Label {...(htmlFor ? { htmlFor } : {})} className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-steel">
        {label}
        {ai && <AiMark />}
      </Label>
      {children}
      {error && <p className="mt-1 text-[12px] font-medium text-att">{error}</p>}
    </div>
  );
}

/** Selected values as removable chips plus an "add" select (taxonomy-controlled lists). */
function MultiPick({ id, options = [], value = [], onChange, max = 20, placeholder = '+ Add' }) {
  const label = (v) => options.find((o) => o.id === v)?.label ?? v;
  const rest = options.filter((o) => !value.includes(o.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(value.filter((x) => x !== v))}
          className="inline-flex items-center gap-1 rounded-sm border border-line2 bg-white px-2 py-0.5 text-[13px] font-semibold hover:border-navy"
          aria-label={`Remove ${label(v)}`}
        >
          {label(v)} <X className="size-3 text-steel" aria-hidden />
        </button>
      ))}
      {value.length < max && rest.length > 0 && (
        <select
          id={id}
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
          className="rounded-sm border border-dashed border-line2 bg-transparent px-1.5 py-0.5 text-[13px] text-steel"
        >
          <option value="">{placeholder}</option>
          {rest.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const YES_NO = [
  { id: true, label: 'Yes' },
  { id: false, label: 'No' },
];

/** F7 commercial-use block: eight tiles; clicking one opens its options below the grid. */
function RightsEditor({ rights, onChange, taxonomy, ai, highlight, warning }) {
  const [open, setOpen] = useState(null);
  const t = taxonomy?.rights;
  if (!t) return null;
  const tiles = [
    { key: 'usage', label: 'Usage', options: t.usage, multi: true },
    { key: 'region', label: 'Region', options: t.regions },
    { key: 'durationMonths', label: 'Duration', options: t.durations },
    { key: 'exclusive', label: 'Exclusive', options: YES_NO },
    { key: 'portfolioAllowed', label: 'Creator portfolio', options: t.portfolioAllowed },
    { key: 'commerciallySafeTools', label: 'Safe tools only', options: YES_NO },
    { key: 'aiLabel', label: 'AI label on posts', options: YES_NO },
    { key: 'likeness', label: 'Real likeness', options: t.likeness },
  ];
  const missing = new Set(rightsMissing(rights));
  const display = (tile) => {
    const v = rights[tile.key];
    if (tile.multi) return v?.length ? v.map((id) => tile.options.find((o) => o.id === id)?.label ?? id).join(' + ') : null;
    if (v == null) return null;
    if (tile.key === 'region' && v === 'custom') return rights.regionNote || 'Custom';
    return tile.options.find((o) => o.id === v)?.label ?? String(v);
  };
  const current = tiles.find((x) => x.key === open);
  const set = (key, value) => onChange({ ...rights, [key]: value });

  return (
    <section
      id="brief-rights"
      aria-labelledby="rights-h"
      className={`scroll-mt-24 rounded-lg border-[1.5px] p-4 sm:p-[18px] ${highlight && missing.size ? 'border-att-ln' : 'border-navy'} ${ai ? 'bg-ai-bg/30' : 'bg-white'}`}
    >
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 id="rights-h" className="flex items-center gap-1.5 font-mono text-[11px] font-normal uppercase tracking-[0.16em] text-steel">
          Commercial use {ai && <AiMark />}
        </h3>
        <Pill tone="dark">F7 · Licensing</Pill>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const value = display(tile);
          const isMissing = missing.has(tile.key);
          return (
            <button
              key={tile.key}
              type="button"
              aria-expanded={open === tile.key}
              onClick={() => setOpen(open === tile.key ? null : tile.key)}
              className={`rounded-md border px-3 py-2.5 text-left transition-colors hover:border-navy ${
                open === tile.key ? 'border-navy ring-2 ring-navy/10' : highlight && isMissing ? 'border-att-ln bg-att-bg/40' : 'border-line bg-white'
              }`}
            >
              <span className="block text-[12px] text-steel">{tile.label}</span>
              <span className={`mt-1 block text-[14px] font-bold leading-snug ${value ? 'text-ink' : 'text-wait'}`}>{value ?? 'Not set'}</span>
            </button>
          );
        })}
      </div>
      {current && (
        <div className="mt-2.5 rounded-md border border-line bg-soft/60 p-3">
          <p className="mb-2 text-[12.5px] font-semibold text-slate">{current.multi ? `${current.label} — pick all that apply` : current.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {current.options.map((o) => {
              const v = rights[current.key];
              const on = current.multi ? v?.includes(o.id) : v === o.id;
              return (
                <ChipSelect
                  key={String(o.id)}
                  selected={on}
                  onClick={() => {
                    if (current.multi) set(current.key, on ? v.filter((x) => x !== o.id) : [...(v ?? []), o.id]);
                    else {
                      set(current.key, o.id);
                      if (current.key !== 'region' || o.id !== 'custom') setOpen(null);
                    }
                  }}
                >
                  {o.label}
                </ChipSelect>
              );
            })}
          </div>
          {current.key === 'region' && rights.region === 'custom' && (
            <input
              className="mt-2.5 h-9 w-full rounded-md border border-line bg-white px-3 text-[14px]"
              placeholder="e.g. India + UAE"
              maxLength={120}
              value={rights.regionNote ?? ''}
              onChange={(e) => set('regionNote', e.target.value)}
              aria-label="Custom region"
            />
          )}
        </div>
      )}
      {highlight && missing.size > 0 && (
        <p className="mt-3 text-[13px] font-medium text-att" role="alert">
          Set usage, region, duration and exclusivity before publishing — creators must know how their work will be used.
        </p>
      )}
      {warning && (
        <Alert tone="warning" className="mt-3">
          {warning}
        </Alert>
      )}
    </section>
  );
}

export default function CampaignFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  useDocumentTitle(isEdit ? 'Edit brief' : 'New brief');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const qc = useQueryClient();
  const toast = useToast();
  const { data: taxonomy } = useTaxonomy();
  const uid = useId();

  const existing = useQuery({ queryKey: ['mine', 'brand-campaign', id], queryFn: () => endpoints.brand.campaign(id), enabled: isEdit });
  const brandProfile = useQuery({ queryKey: ['mine', 'brand-profile'], queryFn: endpoints.brand.profile });
  // Agencies tag every brief with a client ("New brief for…").
  const { profile: account } = useAuth();
  const isAgency = account?.accountType === 'agency';
  const clientsQ = useQuery({ queryKey: ['mine', 'clients'], queryFn: endpoints.brand.clients, enabled: isAgency });
  const clientList = clientsQ.data ?? [];
  const urlClient = params.get('client');
  const kit = brandProfile.data?.brandKit;
  const hasKit = !!(kit && (kit.colors?.length || kit.tone?.length || kit.headingFont || kit.neverDo || kit.assetUrls?.length));

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, handleSubmit, control, reset, formState, setError, watch, getValues, setValue } = form;
  const deliverables = useFieldArray({ control, name: 'deliverables' });

  // Brief-builder state
  const [idea, setIdea] = useState('');
  const [ideaError, setIdeaError] = useState('');
  const [aiFields, setAiFields] = useState(() => new Set());
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [result, setResult] = useState(null);
  const [before, setBefore] = useState(null);
  const [rightsError, setRightsError] = useState(false);
  const rightsRef = useRef(null);

  const edited = (key) =>
    setAiFields((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  const setField = (name, value, aiKey = name) => {
    setValue(name, value, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    edited(aiKey);
  };

  useEffect(() => {
    if (isEdit || !isAgency || !urlClient || getValues('clientId')) return;
    if (clientList.some((c) => c._id === urlClient)) setValue('clientId', urlClient);
  }, [isEdit, isAgency, urlClient, clientList, getValues, setValue]);

  useEffect(() => {
    if (!existing.data) return;
    reset(toForm(existing.data));
    setAiFields(new Set(existing.data.aiFilledFields ?? []));
  }, [existing.data, reset]);

  // "I want something like this" (P3W → ?from=<pieceId>): the piece is sent to the builder as context.
  const fromId = !isEdit ? params.get('from') : null;
  const source = useQuery({ queryKey: ['pub', 'piece', fromId], queryFn: () => endpoints.portfolio.get(fromId), enabled: !!fromId, retry: false });
  useEffect(() => {
    if (!source.data) return;
    const { piece, creator } = source.data;
    const tools = [...new Set([...(piece.workflow ?? []).map((s) => s.tool), ...(piece.tools ?? [])])].filter((t) => taxonomy?.tools.some((o) => o.id === t));
    setIdea((cur) => cur || `Something like “${piece.title}” by ${creator.displayName}, adapted for our brand — not a copy.`);
    reset({
      ...getValues(),
      requiredTools: tools,
      contentType: piece.contentType ?? '',
      sourcePortfolioItemId: piece._id,
    });
  }, [source.data, reset, getValues, taxonomy]);

  const draft = useMutation({
    mutationFn: (mode) =>
      endpoints.brand.draftBrief({
        idea: idea.trim(),
        mode,
        ...(Object.keys(answers).length
          ? { answers: Object.entries(answers).map(([qid, answer]) => ({ id: qid, question: questions.find((q) => q.id === qid)?.question, answer })) }
          : {}),
        ...(fromId && source.data ? { fromPieceId: fromId } : {}),
      }),
    onSuccess: (data) => {
      setBefore((b) => b ?? { values: getValues(), aiFields, questions, warnings });
      reset(draftToForm(data.fields, getValues()), { keepDefaultValues: true });
      setAiFields(new Set(data.fields.aiFilledFields ?? []));
      setQuestions((prev) => [...prev.filter((q) => answers[q.id]), ...(data.questions ?? []).filter((q) => !answers[q.id])].slice(0, 3));
      setWarnings((data.warnings ?? []).filter((w) => !w.startsWith('Template draft')));
      setResult(data);
      setRightsError(false);
    },
  });

  const rewrite = (mode = 'auto') => {
    const words = idea.trim().split(/\s+/).filter(Boolean).length;
    if (idea.trim().length < 15 || words < 3) {
      setIdeaError('Describe the idea in a sentence: product, format, and anything you know about budget or timing.');
      return;
    }
    setIdeaError('');
    draft.mutate(mode);
  };
  const undo = () => {
    if (!before) return;
    reset(before.values, { keepDefaultValues: true });
    setAiFields(before.aiFields);
    setQuestions(before.questions);
    setWarnings(before.warnings);
    setResult(null);
    setBefore(null);
  };

  const save = useMutation({
    mutationFn: (body) => (isEdit ? endpoints.brand.updateCampaign(id, body) : endpoints.brand.createCampaign(body)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      if (data.status === 'open') {
        toast.success(isEdit ? 'Brief updated.' : 'Brief published. Here are your matches.');
        navigate(returnTo ?? `/brand/campaigns/${data._id}/applicants`);
      } else if (data.status === 'closed') {
        toast.success('Brief updated.');
        navigate('/brand/campaigns');
      } else {
        toast.success('Draft saved.');
        if (!isEdit) navigate(`/brand/campaigns/${data._id}/edit`, { replace: true });
      }
    },
    onError: (err) => {
      if (err.code === 'RIGHTS_REQUIRED') {
        setRightsError(true);
        rightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else applyServerErrors(err, setError);
    },
  });

  const submit = (status) => {
    if (status === 'open' && rightsMissing(getValues('rights')).length) setRightsError(true);
    return handleSubmit((v) => {
      if (isAgency && !v.clientId) {
        setError('clientId', { message: 'Choose which client this brief is for' });
        return;
      }
      if (status === 'open' && rightsMissing(v.rights).length) {
        setRightsError(true);
        rightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      save.mutate(toBody({ ...v, status }, aiFields));
    })();
  };

  if (isEdit && existing.isLoading) return <PageLoader label="Loading brief" />;
  if (isEdit && existing.error) return <ErrorState error={existing.error} onRetry={existing.refetch} />;

  const values = watch();
  const filled = filledCount(toBody(values));
  const errors = formState.errors;
  const status = isEdit ? existing.data?.status : 'draft';
  const ai = (k) => aiFields.has(k);
  const likenessWarning = warnings.find((w) => /likeness/i.test(w));
  const deadlineWarnings = warnings.filter((w) => w !== likenessWarning && /deadline|rush|week|days?\b/i.test(w));
  const otherWarnings = warnings.filter((w) => w !== likenessWarning && !deadlineWarnings.includes(w));
  const savedAt = existing.data?.updatedAt ? new Date(existing.data.updatedAt) : null;
  const pieceLabel = source.data ? `${source.data.creator.displayName} · ${source.data.piece.title}` : null;

  return (
    <>
      <PageHeader
        eyebrow={isEdit ? 'Edit brief' : isAgency ? `New brief for ${clientList.find((c) => c._id === values.clientId)?.name ?? '…'}` : 'AI brief builder'}
        title={
          <>
            Say it in one line. <span className="font-medium text-slate">We’ll write the brief.</span>
          </>
        }
        actions={
          savedAt && (
            <span className="self-end text-[13px] text-steel">
              {status === 'draft' ? 'Draft saved' : 'Last saved'} · {savedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )
        }
      />

      {returnTo?.includes('intent=invite') && (
        <Alert tone="info" className="mt-5">
          Publish this brief and you’ll be taken back to the creator to send your invitation.
        </Alert>
      )}
      {source.error && (
        <Alert tone="warning" className="mt-5">
          That portfolio piece isn’t available any more, so the brief starts empty.
        </Alert>
      )}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)]">
        {/* Left: idea + questions */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card pad>
            <label htmlFor={`${uid}-idea`} className="eyebrow">
              Your idea
            </label>
            <textarea
              id={`${uid}-idea`}
              rows={5}
              maxLength={2000}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              disabled={draft.isPending}
              aria-invalid={!!ideaError}
              placeholder="e.g. 30-sec Diwali reel for our mithai gift box. Warm and festive, Hindi voice-over. For Instagram and YouTube Shorts ads. Budget around 15k."
              className="mt-3 w-full resize-y rounded-md border border-line bg-soft/70 px-4 py-3 text-[16px] leading-relaxed outline-none placeholder:text-mist focus:border-navy focus:ring-2 focus:ring-navy/10"
            />
            {ideaError && <p className="mt-1 text-[12.5px] font-medium text-att">{ideaError}</p>}
            {(hasKit || pieceLabel) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {hasKit && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line2 bg-white px-3 py-1 text-[13px] font-semibold text-slate">
                    <Paperclip className="size-3.5" /> Brand kit attached
                  </span>
                )}
                {pieceLabel && (
                  <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-navy px-3 py-1 text-[13px] font-semibold text-white">
                    <Sparkles className="size-3.5 shrink-0" /> From: {pieceLabel}
                  </span>
                )}
              </div>
            )}
            <Button size="lg" className="mt-4 w-full" onClick={() => rewrite('auto')} loading={draft.isPending && draft.variables === 'auto'} disabled={draft.isPending}>
              <Sparkles className="size-4" /> {result ? 'Rewrite brief' : 'Write the brief'}
            </Button>

            {draft.isPending && (
              <p className="mt-3 text-[13px] text-steel" role="status" aria-live="polite">
                {draft.variables === 'template' ? 'Building a template draft…' : 'Drafting your brief. This can take up to 20 seconds…'}
              </p>
            )}
            {draft.error && !draft.isPending && (
              <Alert tone="error" className="mt-3" title={/RATE_LIMITED/.test(draft.error.code ?? '') ? 'Too many requests' : 'Couldn’t write the brief'}>
                {draft.error.message}
              </Alert>
            )}
            {result && !draft.isPending && !draft.error && (
              <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-steel" role="status">
                {result.source === 'ai' ? <Sparkles className="mt-0.5 size-3.5 shrink-0" /> : <FileText className="mt-0.5 size-3.5 shrink-0" />}
                {result.source === 'ai'
                  ? `Drafted by ${result.model}. Check every field before publishing.`
                  : result.reason === 'no_api_key'
                    ? 'Template draft — AI isn’t configured on this server, so fields were filled from keywords in your idea.'
                    : 'Template draft built from keywords in your idea (no AI used).'}
              </p>
            )}
            {(before || draft.error?.code?.startsWith('AI_') || result) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {before && (
                  <Button variant="ghost" size="sm" onClick={undo} disabled={draft.isPending}>
                    <RotateCcw className="size-3.5" /> Undo draft
                  </Button>
                )}
                {(draft.error?.code?.startsWith('AI_') || result?.source === 'ai') && (
                  <Button variant="secondary" size="sm" onClick={() => rewrite('template')} disabled={draft.isPending}>
                    <FileText className="size-3.5" /> Use template instead
                  </Button>
                )}
              </div>
            )}
          </Card>

          {questions.length > 0 && (
            <Card pad>
              <p className="eyebrow">AI asked you</p>
              <div className="mt-1 divide-y divide-line">
                {questions.map((q) => (
                  <fieldset key={q.id} className="py-3.5 last:pb-0">
                    <legend className="contents">
                      <span className="mb-2.5 block text-[14.5px] font-bold">{q.question}</span>
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o) => (
                        <ChipSelect key={o} selected={answers[q.id] === o} onClick={() => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === o ? undefined : o }))}>
                          {o}
                        </ChipSelect>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              {Object.values(answers).some(Boolean) && <p className="mt-3 text-[12.5px] text-steel">Click Rewrite brief to apply your answers.</p>}
            </Card>
          )}
        </div>

        {/* Right: live brief */}
        <Card as="form" onSubmit={(e) => e.preventDefault()} noValidate className="shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 text-[17px] tracking-[-0.02em]">
              <i className="size-2 rounded-full bg-ok-ln" aria-hidden /> Live brief
            </h2>
            <div className="flex items-center gap-2.5 text-[12.5px] text-steel">
              <span>
                {filled} of {BRIEF_FIELDS.length} filled
              </span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-line" aria-hidden>
                <span className="block h-full rounded-full bg-ok transition-[width]" style={{ width: `${(filled / BRIEF_FIELDS.length) * 100}%` }} />
              </span>
            </div>
          </div>

          <div className="space-y-2.5 p-4 sm:p-5">
            <div className={`rounded-md border px-1 py-1 ${errors.title ? 'border-att-ln' : ai('title') ? 'border-ai-ln bg-ai-bg/40' : 'border-transparent'}`}>
              <label htmlFor={`${uid}-title`} className="sr-only">
                Campaign title
              </label>
              <input
                id={`${uid}-title`}
                placeholder="Campaign title"
                className="w-full bg-transparent px-1 text-[24px] font-extrabold tracking-[-0.03em] outline-none placeholder:text-mist sm:text-[28px]"
                {...register('title', { onChange: () => edited('title') })}
              />
              {errors.title && <p className="px-1 text-[12px] font-medium text-att">{errors.title.message}</p>}
            </div>

            {otherWarnings.length > 0 && (
              <Alert tone="warning">
                {otherWarnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </Alert>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Tile label="Content type" ai={ai('contentType')} htmlFor={`${uid}-ct`} onEdit={() => edited('contentType')}>
                <select id={`${uid}-ct`} className={bare} {...register('contentType')}>
                  <option value="">Choose…</option>
                  {taxonomy?.contentTypes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Tile>
              <Tile label="Formats" ai={ai('formats')}>
                <div className="flex flex-wrap gap-1.5">
                  {taxonomy?.formats.map((o) => {
                    const on = values.formats.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setField('formats', on ? values.formats.filter((x) => x !== o.id) : [...values.formats, o.id])}
                        className={`rounded-sm border px-2 py-0.5 text-[13px] font-semibold ${on ? 'border-navy bg-navy text-white' : 'border-line2 bg-white text-steel hover:border-navy'}`}
                      >
                        {o.id}
                      </button>
                    );
                  })}
                </div>
              </Tile>
              <Tile label="Length" ai={ai('lengthNote')} htmlFor={`${uid}-len`} onEdit={() => edited('lengthNote')}>
                <input id={`${uid}-len`} className={bare} placeholder="e.g. 30 s main + 15 s cut" {...register('lengthNote')} />
              </Tile>
              <Tile label="Style" ai={ai('style')} htmlFor={`${uid}-style`} onEdit={() => edited('style')}>
                <textarea id={`${uid}-style`} rows={2} className={`${bare} resize-none leading-snug`} placeholder="Look, light, palette, pace" {...register('style')} />
              </Tile>
              <Tile label="Language" ai={ai('languages')} htmlFor={`${uid}-lang`}>
                <MultiPick id={`${uid}-lang`} options={taxonomy?.languages} value={values.languages} onChange={(v) => setField('languages', v)} placeholder="+ Language" />
              </Tile>
              <Tile label="Budget" ai={ai('budget')} error={errors.budgetMax?.message || errors.budgetMin?.message} onEdit={() => edited('budget')}>
                <div className="flex items-center gap-1.5 text-[15px] font-semibold">
                  <span className="text-steel">₹</span>
                  <input type="number" min="0" inputMode="numeric" aria-label="Budget from" placeholder="From" className={`${bare} !w-24`} {...register('budgetMin')} />
                  <span className="text-steel">–</span>
                  <input type="number" min="0" inputMode="numeric" aria-label="Budget to" placeholder="To" className={`${bare} !w-24`} {...register('budgetMax')} />
                </div>
              </Tile>
              <Tile label="Deliverables" ai={ai('deliverables')} onEdit={() => edited('deliverables')}>
                <ul className="space-y-1.5">
                  {deliverables.fields.map((field, i) => (
                    <li key={field.id}>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          aria-label={`Quantity for deliverable ${i + 1}`}
                          className="w-10 shrink-0 rounded-sm border border-line bg-white px-1 text-center text-[14px] font-semibold outline-none focus:border-navy"
                          {...register(`deliverables.${i}.quantity`)}
                        />
                        <span className="text-steel">×</span>
                        <input aria-label={`Deliverable ${i + 1}`} placeholder="e.g. 30 s reel" className={bare} {...register(`deliverables.${i}.title`)} />
                        <button
                          type="button"
                          onClick={() => {
                            deliverables.remove(i);
                            edited('deliverables');
                          }}
                          className="shrink-0 p-1 text-steel hover:text-att"
                          aria-label={`Remove deliverable ${i + 1}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <input
                        aria-label={`Notes for deliverable ${i + 1}`}
                        placeholder="Format / notes"
                        className="ml-[3.75rem] mt-0.5 w-[calc(100%-3.75rem)] bg-transparent text-[12.5px] text-steel outline-none placeholder:text-mist"
                        {...register(`deliverables.${i}.description`)}
                      />
                    </li>
                  ))}
                </ul>
                {deliverables.fields.length < 20 && (
                  <button
                    type="button"
                    onClick={() => deliverables.append({ title: '', description: '', quantity: 1 })}
                    className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-navy hover:underline"
                  >
                    <Plus className="size-3.5" /> Add deliverable
                  </button>
                )}
              </Tile>
              <Tile label="Deadline" ai={ai('deadline')} htmlFor={`${uid}-dl`} onEdit={() => edited('deadline')}>
                <input id={`${uid}-dl`} type="date" className={bare} {...register('deadline')} />
                {deadlineWarnings.map((w) => (
                  <p key={w} className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-wait">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {w}
                  </p>
                ))}
              </Tile>
              <Tile label="Suggested tools" ai={ai('requiredTools')} htmlFor={`${uid}-tools`}>
                <MultiPick id={`${uid}-tools`} options={taxonomy?.tools} value={values.requiredTools} onChange={(v) => setField('requiredTools', v)} placeholder="+ Tool" />
              </Tile>
              <Tile label="Revisions" htmlFor={`${uid}-rev`}>
                <select id={`${uid}-rev`} className={bare} {...register('revisionsIncluded')}>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'No revisions' : `${n} round${n > 1 ? 's' : ''} included`}
                    </option>
                  ))}
                </select>
              </Tile>
              {isAgency && (
                <Tile label="Client" error={errors.clientId?.message} htmlFor={`${uid}-client`}>
                  <select id={`${uid}-client`} className={bare} {...register('clientId')}>
                    <option value="">Choose a client…</option>
                    {clientList.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Tile>
              )}
              <Tile label="Industry" ai={ai('category')} error={errors.category?.message} htmlFor={`${uid}-cat`} onEdit={() => edited('category')}>
                <select id={`${uid}-cat`} className={bare} {...register('category')}>
                  <option value="">Choose…</option>
                  {taxonomy?.specializations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Tile>
              <Tile label="Skills" ai={ai('requiredSkills')} htmlFor={`${uid}-skills`}>
                <MultiPick id={`${uid}-skills`} options={taxonomy?.skills} value={values.requiredSkills} onChange={(v) => setField('requiredSkills', v)} placeholder="+ Skill" />
              </Tile>
              <Tile label="The brief" ai={ai('brief')} error={errors.brief?.message} htmlFor={`${uid}-brief`} onEdit={() => edited('brief')} className="sm:col-span-2">
                <textarea
                  id={`${uid}-brief`}
                  rows={5}
                  className={`${bare} resize-y font-medium leading-relaxed`}
                  placeholder="What you’re launching, who it’s for, how it should feel, and what to avoid."
                  {...register('brief')}
                />
              </Tile>
            </div>

            <div ref={rightsRef} className="pt-2.5">
              <RightsEditor
                rights={values.rights}
                taxonomy={taxonomy}
                ai={ai('rights')}
                highlight={rightsError}
                warning={likenessWarning}
                onChange={(r) => {
                  setField('rights', r, 'rights');
                  if (rightsError && !rightsMissing(r).length) setRightsError(false);
                }}
              />
            </div>

            {save.error && !save.error.details?.length && save.error.code !== 'RIGHTS_REQUIRED' && <Alert tone="error">{save.error.message}</Alert>}
            {Object.keys(errors).length > 0 && formState.isSubmitted && <Alert tone="error">Please fix the highlighted fields.</Alert>}

            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] text-steel">Creators see this brief exactly like this.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {status === 'draft' ? (
                  <>
                    <Button variant="secondary" size="lg" onClick={() => submit('draft')} loading={save.isPending && save.variables?.status === 'draft'}>
                      Save draft
                    </Button>
                    <Button size="lg" onClick={() => submit('open')} loading={save.isPending && save.variables?.status === 'open'}>
                      Publish &amp; see matches <ArrowRight className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button size="lg" onClick={() => submit(status)} loading={save.isPending}>
                    Save changes
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
