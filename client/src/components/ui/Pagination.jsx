import { ArrowLeft, ArrowRight } from 'lucide-react';

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-beige/70 pt-6" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:text-muted/50"
      >
        <ArrowLeft className="size-4" /> Previous
      </button>
      <span className="font-mono text-xs text-muted">
        {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:text-muted/50"
      >
        Next <ArrowRight className="size-4" />
      </button>
    </nav>
  );
}
