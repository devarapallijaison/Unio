import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../services/api.js';

/**
 * Controlled lists from GET /api/taxonomy (categories, content types, specializations, skills,
 * tools, styles, formats, languages, team sizes). Loaded once per session.
 */
export function useTaxonomy() {
  return useQuery({ queryKey: ['taxonomy'], queryFn: endpoints.taxonomy, staleTime: Infinity, gcTime: Infinity });
}

/** id → label lookup for one list, e.g. labelOf(data, 'categories', 'video'). */
export function labelOf(taxonomy, list, id) {
  return taxonomy?.[list]?.find((item) => item.id === id)?.label ?? id;
}
