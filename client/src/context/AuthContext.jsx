import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';
import { ApiError, endpoints } from '../services/api.js';

const AuthContext = createContext(null);
const ME_KEY = ['auth', 'me'];

async function fetchSession() {
  try {
    return await endpoints.auth.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const session = useQuery({ queryKey: ME_KEY, queryFn: fetchSession, staleTime: 5 * 60_000, retry: 1 });

  // Drop cached data from any previous session so one account never sees another's lists.
  const resetOtherQueries = () => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });

  const onAuthed = (data) => {
    resetOtherQueries();
    qc.setQueryData(ME_KEY, data);
  };

  const login = useMutation({ mutationFn: endpoints.auth.login, onSuccess: onAuthed });
  const register = useMutation({ mutationFn: endpoints.auth.register, onSuccess: onAuthed });
  const logout = useMutation({
    mutationFn: endpoints.auth.logout,
    onSettled: () => {
      resetOtherQueries();
      qc.setQueryData(ME_KEY, null);
    },
  });

  const value = useMemo(
    () => ({
      user: session.data?.user ?? null,
      profile: session.data?.profile ?? null,
      isLoading: session.isLoading,
      sessionError: session.error,
      refresh: () => qc.invalidateQueries({ queryKey: ME_KEY }),
      login,
      register,
      logout,
    }),
    [session.data, session.isLoading, session.error, login, register, logout, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
