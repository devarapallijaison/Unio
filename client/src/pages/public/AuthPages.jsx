import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Eye, EyeOff, Palette } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Input, applyServerErrors } from '../../components/ui/Form.jsx';
import { LogoFull } from '../../components/ui/Logo.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { safeReturnTo } from '../../lib/returnTo.js';

/** Explains why the user is being asked to sign in, based on the preserved intent. */
function intentContext(returnTo) {
  if (!returnTo) return null;
  if (returnTo.includes('intent=apply')) return { text: 'Sign in with a creator account to apply to this campaign. You’ll review your application before it’s sent.', role: 'creator' };
  if (returnTo.includes('intent=invite')) return { text: 'Sign in with a brand account to invite this creator. You’ll choose a campaign before anything is sent.', role: 'brand' };
  return { text: 'Sign in to continue where you left off.' };
}

function AuthShell({ title, subtitle, children, aside }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-[420px]">
          <h1 className="text-4xl leading-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-forest lg:flex lg:flex-col lg:justify-between lg:p-14">
        <LogoFull variant="light" className="h-20" />
        <div className="relative z-10 max-w-md">{aside}</div>
        <svg className="absolute -bottom-40 -right-40 size-[560px] opacity-[0.12]" viewBox="0 0 200 200" aria-hidden>
          <circle cx="70" cy="100" r="60" fill="#C7D2C2" />
          <circle cx="130" cy="100" r="60" fill="#EADFCF" />
        </svg>
      </div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const context = intentContext(returnTo);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { register, handleSubmit, formState, setError } = form;

  // On success the session updates and <GuestOnly> forwards to returnTo or the dashboard.
  const onSubmit = (values) => login.mutate(values, { onError: (err) => applyServerErrors(err, setError) });

  const registerHref = `/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage briefs, proposals and projects."
      aside={
        <>
          <p className="font-display text-4xl leading-tight text-ivory">“A good brief and the right creator is most of the work.”</p>
          <p className="mt-5 text-[15px] text-ivory/70">UNIO keeps briefs, proposals and deliverables in one place for both sides.</p>
        </>
      }
    >
      {context && <Alert tone="info" className="mb-6">{context.text}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-[34px] p-1 text-muted hover:text-ink"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {login.error && !login.error.details?.length && <Alert tone="error">{login.error.message}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>
      <p className="mt-8 text-[15px] text-muted">
        New to UNIO?{' '}
        <Link to={registerHref} className="font-medium text-forest underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

const registerSchema = z.object({
  role: z.enum(['creator', 'brand'], { errorMap: () => ({ message: 'Choose how you’ll use UNIO' }) }),
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
});

const ROLES = [
  { value: 'creator', title: 'I’m a creator', body: 'Show your portfolio, apply to briefs and deliver projects.', Icon: Palette },
  { value: 'brand', title: 'I’m a brand', body: 'Post briefs, review proposals and invite creators.', Icon: Briefcase },
];

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { register: signUp } = useAuth();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const context = intentContext(returnTo);
  const initialRole = context?.role ?? (['creator', 'brand'].includes(params.get('role')) ? params.get('role') : undefined);

  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole, name: '', email: '', password: '' },
  });
  const { register, handleSubmit, formState, setError, watch } = form;
  const role = watch('role');

  const onSubmit = (values) => signUp.mutate(values, { onError: (err) => applyServerErrors(err, setError) });
  const loginHref = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;

  return (
    <AuthShell
      title="Join UNIO"
      subtitle="One account, one role. Pick the side of the table you’re on."
      aside={
        <ul className="space-y-6 text-ivory">
          {[
            ['Public by default', 'Anyone can browse creators and briefs — accounts are only for taking action.'],
            ['Explicit at every step', 'Applications and invitations are always reviewed before they’re sent.'],
            ['One project per match', 'An accepted proposal or invitation becomes a single tracked project.'],
          ].map(([t, b]) => (
            <li key={t} className="border-t border-ivory/20 pt-5">
              <p className="font-display text-2xl">{t}</p>
              <p className="mt-1.5 text-[15px] text-ivory/70">{b}</p>
            </li>
          ))}
        </ul>
      }
    >
      {context && <Alert tone="info" className="mb-6">{context.text}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">How will you use UNIO?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map(({ value, title, body, Icon }) => (
              <label
                key={value}
                className={`flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-colors ${
                  role === value ? 'border-forest bg-mint/70' : 'border-beige bg-white hover:border-forest/50'
                }`}
              >
                <input type="radio" value={value} className="sr-only" {...register('role')} />
                <Icon className={`size-5 ${role === value ? 'text-forest' : 'text-muted'}`} strokeWidth={1.5} />
                <span className="font-medium">{title}</span>
                <span className="text-[13px] leading-snug text-muted">{body}</span>
              </label>
            ))}
          </div>
          {formState.errors.role && (
            <p role="alert" className="mt-1.5 text-[13px] text-danger">
              {formState.errors.role.message}
            </p>
          )}
        </fieldset>
        <Input
          label={role === 'brand' ? 'Company or brand name' : 'Your name'}
          autoComplete={role === 'brand' ? 'organization' : 'name'}
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters with a letter and a number."
          error={formState.errors.password?.message}
          {...register('password')}
        />
        {signUp.error && !signUp.error.details?.length && <Alert tone="error">{signUp.error.message}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={signUp.isPending}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-[15px] text-muted">
        Already have an account?{' '}
        <Link to={loginHref} className="font-medium text-forest underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
