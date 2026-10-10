import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/** Filter state stored in the URL so results are shareable and survive refresh/back. */
export function useUrlFilters(keys) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])), [params, keys]);

  const set = useCallback(
    (patch, { resetPage = true } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null) next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => setParams({}, { replace: true }), [setParams]);
  const activeCount = keys.filter((k) => k !== 'page' && k !== 'sort' && values[k]).length;

  return { values, set, clear, activeCount };
}

/** Debounced text input bound to a URL filter. */
export function useDebouncedCallback(fn, delay = 350) {
  return useMemo(() => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }, [fn, delay]);
}
