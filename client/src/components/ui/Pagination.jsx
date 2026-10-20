import { ArrowLeft, ArrowRight } from 'lucide-react';

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between border-t border-line pt-6" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex h-[34px] items-center gap-2 rounded-full border border-navy px-[13px] text-[13px] font-semibold text-navy transition-colors hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-line2 disabled:text-mist disabled:hover:bg-transparent"
      >
        <ArrowLeft className="size-4" /> Previous
      </button>
      <span className="font-mono text-xs text-steel">
        {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex h-[34px] items-center gap-2 rounded-full border border-navy px-[13px] text-[13px] font-semibold text-navy transition-colors hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:border-line2 disabled:text-mist disabled:hover:bg-transparent"
      >
        Next <ArrowRight className="size-4" />
      </button>
    </nav>
  );
}
