import { useMutation } from '@tanstack/react-query';
import { FileText, RotateCcw, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { endpoints } from '../../services/api.js';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { Textarea } from '../ui/Form.jsx';

const EXAMPLES = [
  'Short vertical reels for our new masala chai blend, warm home-kitchen feel, budget around ₹15k, needed in 2 weeks',
  '30-second product film for noise-cancelling earbuds, architectural and minimal, no voiceover',
  'Lookbook imagery for a block-print resort-wear capsule, desert light, 12 looks',
];

/**
 * Generates an editable campaign draft from a rough idea. Nothing is saved: the result only
 * fills the form, and the brand reviews, edits and saves as usual.
 */
export function AiBriefBuilder({ onApply, onUndo, canUndo }) {
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState('');
  const [ideaError, setIdeaError] = useState('');
  const [result, setResult] = useState(null);

  const draft = useMutation({
    mutationFn: (mode) => endpoints.brand.draftBrief({ idea: idea.trim(), mode }),
    onSuccess: (data) => {
      setResult(data);
      onApply(data.fields);
    },
  });

  const generate = (mode = 'auto') => {
    const words = idea.trim().split(/\s+/).filter(Boolean).length;
    if (idea.trim().length < 15 || words < 3) {
      setIdeaError('Describe the idea in at least a sentence: product, format, and anything you know about budget or timing.');
      return;
    }
    setIdeaError('');
    draft.mutate(mode);
  };

  if (!open) {
    return (
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-sage bg-mint/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-medium text-forest">
            <Sparkles className="size-4" strokeWidth={1.75} /> Start from a rough idea
          </p>
          <p className="mt-1 text-[14px] text-muted">Describe the campaign in a sentence and get a structured draft you can edit before saving.</p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)} className="shrink-0">
          <Sparkles className="size-4" /> Create with AI
        </Button>
      </div>
    );
  }

  const aiError = draft.error;
  const fallbackOffered = aiError && aiError.code?.startsWith('AI_');

  return (
    <section className="mb-6 rounded-lg border border-sage bg-white p-5 sm:p-6" aria-labelledby="ai-brief-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="ai-brief-title" className="flex items-center gap-2 font-sans text-[15px] font-semibold">
            <Sparkles className="size-4 text-forest" strokeWidth={1.75} /> Create with AI
          </h2>
          <p className="mt-1 text-[13px] text-muted">The draft fills the form below. Nothing is saved until you click save.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close AI builder">
          <X className="size-4" />
        </button>
      </div>

      <Textarea
        className="mt-4"
        label="Your idea"
        rows={3}
        maxLength={2000}
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        error={ideaError}
        placeholder="e.g. Short vertical reels for our new masala chai blend, warm home-kitchen feel, budget around ₹15k, needed in 2 weeks"
        disabled={draft.isPending}
      />
      {!idea && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setIdea(ex)}
              className="max-w-full truncate rounded-sm border border-dashed border-beige px-2 py-0.5 text-left text-[12px] text-muted hover:border-forest hover:text-forest"
            >
              {ex.length > 60 ? `${ex.slice(0, 58)}…` : ex}
            </button>
          ))}
        </div>
      )}

      {draft.isPending && (
        <div className="mt-4 flex items-center gap-3 rounded-md bg-mint/60 px-4 py-3 text-[14px] text-forest" role="status" aria-live="polite">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-forest/40" />
            <span className="relative inline-flex size-2.5 rounded-full bg-forest" />
          </span>
          {draft.variables === 'template' ? 'Building a template draft…' : 'Drafting your brief. This can take up to 20 seconds…'}
        </div>
      )}

      {aiError && !draft.isPending && (
        <Alert tone="error" className="mt-4" title={aiError.code === 'RATE_LIMITED' || aiError.code === 'AI_RATE_LIMITED' ? 'Too many requests' : 'Couldn’t generate a draft'}>
          {aiError.message}
        </Alert>
      )}

      {result && !draft.isPending && !aiError && (
        <div className="mt-4 space-y-2" role="status">
          <div
            className={`flex flex-wrap items-center gap-2 rounded-md px-4 py-3 text-[14px] ${
              result.source === 'ai' ? 'border border-sage bg-mint/60 text-forest' : 'border border-dashed border-beige bg-sand/40 text-ink'
            }`}
          >
            {result.source === 'ai' ? <Sparkles className="size-4" /> : <FileText className="size-4" />}
            <span className="font-medium">{result.source === 'ai' ? 'AI draft applied' : 'Template draft applied (no AI used)'}</span>
            <span className="text-muted">
              {result.source === 'ai'
                ? `· generated by ${result.model}. Review every field before publishing.`
                : result.reason === 'no_api_key'
                  ? '· AI isn’t configured on this server, so a keyword-based template was used.'
                  : '· built from keywords in your idea.'}
            </span>
          </div>
          {result.warnings?.filter((w) => !w.startsWith('Template draft')).length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-muted">
              {result.warnings
                .filter((w) => !w.startsWith('Template draft'))
                .map((w) => (
                  <li key={w}>{w}</li>
                ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-beige/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {canUndo && (
            <Button variant="ghost" size="sm" onClick={onUndo} disabled={draft.isPending}>
              <RotateCcw className="size-3.5" /> Undo draft
            </Button>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {(fallbackOffered || result) && (
            <Button variant="secondary" size="sm" onClick={() => generate('template')} loading={draft.isPending && draft.variables === 'template'}>
              <FileText className="size-3.5" /> Use template instead
            </Button>
          )}
          <Button size="sm" onClick={() => generate('auto')} loading={draft.isPending && draft.variables === 'auto'}>
            <Sparkles className="size-3.5" /> {result || aiError ? 'Generate again' : 'Generate draft'}
          </Button>
        </div>
      </div>
    </section>
  );
}
