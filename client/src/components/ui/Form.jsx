import { X } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';

/* v9 .input: height 44, radius 8, border #9AA5AA. `ai` = AI-filled tint until the user edits it. */
const control =
  'w-full rounded-md border px-3 text-[14px] font-medium text-ink placeholder:font-normal placeholder:text-steel/70 transition-colors ' +
  'focus:outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-soft disabled:text-steel';

const tone = (error, ai) => {
  if (error) return 'border-att bg-white';
  if (ai) return 'border-ai-ln bg-[linear-gradient(0deg,rgba(230,234,247,.55),rgba(230,234,247,.55)),#fff]';
  return 'border-[#9aa5aa] bg-white';
};

export function Field({ label, hint, error, required, children, id, className = '', labelExtra }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <span>
            {label}
            {required && <span className="ml-0.5 text-att" aria-hidden>*</span>}
          </span>
          {labelExtra}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] font-medium text-att">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-steel">
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

export const Input = forwardRef(function Input({ label, hint, error, required, className, prefix, ai, labelExtra, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className} labelExtra={labelExtra}>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-steel">{prefix}</span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`${control} ${tone(error, ai)} h-11 ${prefix ? 'pl-8' : ''}`}
          {...props}
        />
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, hint, error, required, className, rows = 5, ai, labelExtra, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className} labelExtra={labelExtra}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} ${tone(error, ai)} py-2.5 leading-normal`}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, hint, error, required, className, children, ai, labelExtra, ...props }, ref) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id} className={className} labelExtra={labelExtra}>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={`${control} ${tone(error, ai)} h-11 appearance-none pr-9`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%234A5C6A' stroke-width='1.6'%3E%3Cpath d='M2 4.5 6 8l4-3.5'/%3E%3C/svg%3E")${ai ? ', linear-gradient(0deg,rgba(230,234,247,.55),rgba(230,234,247,.55))' : ''}`,
          backgroundPosition: 'right 12px center, 0 0',
          backgroundRepeat: 'no-repeat',
        }}
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
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
      <input id={id} type="checkbox" className="mt-0.5 size-[17px] accent-navy" {...props} />
      <span>
        <span className="text-[13.5px] font-medium">{label}</span>
        {description && <span className="block text-[12.5px] text-steel">{description}</span>}
      </span>
    </label>
  );
}

/** Facet checkbox row with an optional count on the right (v9 .chk). Zero counts are greyed. */
export function CheckRow({ label, count, checked, onChange, ...props }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[30px] cursor-pointer items-center gap-2.5 text-[13.5px] font-medium ${count === 0 && !checked ? 'text-mist' : ''}`}
    >
      <input id={id} type="checkbox" className="size-[17px] shrink-0 accent-navy" checked={checked} onChange={onChange} {...props} />
      <span className="min-w-0 flex-1">{label}</span>
      {count != null && <span className="text-[12px] tabular-nums text-steel">{count}</span>}
    </label>
  );
}

/** Toggleable pill chip (v9 .chipsel); selected = navy. */
export function ChipSelect({ selected = false, onClick, children, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        selected ? 'border-navy bg-navy text-white' : 'border-line2 bg-white text-slate hover:border-navy'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Segmented control (v9 .seg). options: [{ value, label }]. */
export function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex flex-wrap rounded-full border border-line2 bg-white p-[3px] ${className}`}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-[13px] py-1.5 text-[13px] font-semibold transition-colors ${on ? 'bg-navy text-white' : 'text-steel hover:text-ink'}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15 ${tone(error)}`}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-navy py-0.5 pl-2.5 pr-1 text-[12.5px] font-semibold text-white">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="rounded-full p-0.5 hover:bg-white/15"
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
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-[14px] font-medium outline-none placeholder:font-normal placeholder:text-steel/70"
        />
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-line2 bg-white px-2.5 py-0.5 text-[12px] font-medium text-steel hover:border-navy hover:text-navy"
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
