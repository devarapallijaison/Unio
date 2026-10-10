import { X } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';

const control =
  'w-full rounded-md border bg-white px-3 text-[15px] text-ink placeholder:text-muted/70 transition-colors ' +
  'focus:outline-none focus:border-forest focus:ring-2 focus:ring-forest/15 disabled:bg-ivory disabled:text-muted';

const tone = (error) => (error ? 'border-danger/70' : 'border-beige');

export function Field({ label, hint, error, required, children, id, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const Input = forwardRef(function Input({ label, hint, error, required, className, prefix, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{prefix}</span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${control} ${tone(error)} h-11 ${prefix ? 'pl-8' : ''}`}
          {...props}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, className, rows = 5, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} ${tone(error)} py-2.5 leading-relaxed`}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, required, className, children, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} ${tone(error)} h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23656B60' stroke-width='1.5'%3E%3Cpath d='M2 4.5 6 8l4-3.5'/%3E%3C/svg%3E")] bg-[position:right_12px_center] bg-no-repeat pr-9`}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, ...props }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-forest" {...props} />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Tag entry: type and press Enter or comma. Controlled via value/onChange (array of strings). */
export function TagInput({ label, hint, error, value = [], onChange, placeholder = 'Type and press Enter', suggestions = [], max = 30 }) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const tag = raw.trim().replace(/,$/, '');
    if (!tag || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15 ${tone(error)}`}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-sm bg-mint py-0.5 pl-2 pr-1 text-[13px] text-forest">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-sm p-0.5 hover:bg-sage"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            add(draft);
            setDraft('');
          }}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-muted/70"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-sm border border-dashed border-beige px-2 py-0.5 text-[12px] text-muted hover:border-forest hover:text-forest"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

/** Applies server-side validation details to react-hook-form fields. Returns unmatched messages. */
export function applyServerErrors(err, setError) {
  const leftovers = [];
  for (const d of err?.details ?? []) {
    if (d.field) setError(d.field, { type: 'server', message: d.message });
    else leftovers.push(d.message);
  }
  return leftovers;
}
