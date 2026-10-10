import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardFor, safeReturnTo } from '../../lib/returnTo.js';
import { ButtonLink } from '../ui/Button.jsx';
import { ErrorState, PageLoader } from '../ui/Feedback.jsx';

export function WrongRole({ user, required, message }) {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg rounded-lg border border-beige bg-white p-8">
        <ShieldAlert className="size-7 text-forest" strokeWidth={1.5} />
        <h1 className="mt-4 text-2xl">This area is for {required} accounts</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {message ??
            `You’re signed in as ${user.name} with a ${user.role} account. Each account has one role, so this page isn’t available to you.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink to={dashboardFor(user.role)}>Go to your dashboard</ButtonLink>
          <ButtonLink to="/" variant="ghost">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

/** Guards a route subtree by authentication and role. Backend enforces the same rules. */
export function ProtectedRoute({ role }) {
  const { user, isLoading, sessionError, refresh } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader label="Checking your session" />;
  if (sessionError) {
    return (
      <div className="container-page py-16">
        <ErrorState error={sessionError} onRetry={refresh} title="We couldn’t check your session" />
      </div>
    );
  }
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (role && user.role !== role) return <WrongRole user={user} required={role} />;
  return <Outlet />;
}

/**
 * Login/register pages send signed-in users onward: to a validated `returnTo`
 * (resuming the action they started) or to their dashboard.
 */
export function GuestOnly({ children }) {
  const { user, isLoading } = useAuth();
  const [params] = useSearchParams();
  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to={safeReturnTo(params.get('returnTo')) ?? dashboardFor(user.role)} replace />;
  return children;
}
