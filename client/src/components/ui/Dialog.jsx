import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Accessible modal dialog: focus moves inside on open, Escape closes, focus is trapped,
 * and focus returns to the previously focused element on close.
 */
export function Dialog({ open, onClose, title, description, children, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const focusables = () =>
      node.querySelectorAll('a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])');
    (focusables()[1] ?? focusables()[0] ?? node).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const list = [...focusables()];
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/50 animate-[rise_200ms_ease-out_both]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-xl bg-white shadow-pop sm:rounded-lg animate-rise`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-steel">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 rounded-full p-1.5 text-steel hover:bg-navy/[0.06] hover:text-ink" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
