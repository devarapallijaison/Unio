import { useSearchParams } from 'react-router';

/**
 * An agency's client switcher lives in the URL (?client=<id>), so a scoped view survives refresh and sharing.
 * `clientId` is '' for "All clients".
 */
export function useClientScope() {
  const [params, setParams] = useSearchParams();
  const clientId = params.get('client') ?? '';
  const setClient = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('client', id);
        else next.delete('client');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  return { clientId, setClient };
}

/** Keep the chosen client when moving between workspace pages. */
export const withClient = (to, clientId) => (clientId ? `${to}${to.includes('?') ? '&' : '?'}client=${clientId}` : to);
