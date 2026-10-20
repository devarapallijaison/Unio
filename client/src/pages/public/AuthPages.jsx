import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Check, Eye, EyeOff, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Input, applyServerErrors } from '../../components/ui/Form.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
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

/** Decorative fanned cards on the dark side (Steel fallback art — no real work is implied). */
function ArtFan() {
  const cards = [
    { seed: 'auth-a', cls: 'left-[4%] top-[12%] -rotate-[4deg]' },
    { seed: 'auth-c', cls: 'left-[34%] top-0 -rotate-[1.5deg]' },
    { seed: 'auth-e', cls: 'left-[65%] top-[4%] rotate-[3deg]' },
  ];
  return (
    <div className="relative h-[380px]" aria-hidden>
      {cards.map((c) => (
        <div key={c.seed} className={`absolute w-[30%] overflow-hidden rounded-lg shadow-pop ${c.cls}`}>
          <MediaFrame item={{ _id: c.seed }} aspect="aspect-[3/5]" className="rounded-none" showLabel={false} hover={false} />
        </div>
      ))}
    </div>
  );
}

/** Split screen (v9 P7/P8): dark statement + art on the left, form on the right. */
function AuthShell({ title, subtitle, children, aside }) {
  return (
    <main id="main" className="grid min-h-dvh bg-white lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,var(--color-ink),var(--color-slate))] pl-9 pt-9 lg:flex">
        <Link to="/" aria-label="UNIO home" className="self-start">
          <Logo onDark className="h-[30px]" />
        </Link>
        <div className="relative z-10 max-w-[460px] pr-9">{aside}</div>
        <ArtFan />
      </div>
      <div className="flex justify-center px-4 py-10 sm:px-6 lg:py-12">
        <div className="w-full max-w-[420px]">
          <Link to="/" aria-label="UNIO home" className="mb-8 inline-block lg:hidden">
            <Logo className="h-7" />
          </Link>
          <h1 className="text-[34px] sm:text-[38px]">{title}</h1>
          {subtitle && <p className="mt-3 text-[15px] text-steel">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
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
      subtitle="Sign in to your UNIO workspace."
      aside={
        <>
          <p className="eyebrow text-mist">How UNIO works</p>
          <p className="mt-4 text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-white">
            A good brief and the right creator is most of the work.
          </p>
          <p className="mt-4 text-[14px] text-mist">UNIO keeps briefs, proposals and deliverables in one place for both sides.</p>
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
            className="absolute right-3 top-[34px] p-1 text-steel hover:text-ink"
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
      <p className="mt-5 text-center text-[13.5px] text-steel">
        New here?{' '}
        <Link to={registerHref} className="font-bold text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <Alert tone="success" className="mt-5">
        Reviewers sign in here too — their accounts are created by UNIO, not on the join page.
      </Alert>
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
  { value: 'creator', title: 'Creator', body: 'Show your portfolio, apply to briefs and deliver projects.', Icon: ImageIcon },
  { value: 'brand', title: 'Brand', body: 'Post briefs, review proposals and invite creators.', Icon: Briefcase },
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
        <>
          <p className="eyebrow text-mist">Why UNIO</p>
          <ul className="mt-4 space-y-5 text-white">
            {[
              ['Public by default', 'Anyone can browse creators and briefs — accounts are only for taking action.'],
              ['Explicit at every step', 'Applications and invitations are always reviewed before they’re sent.'],
              ['One project per match', 'An accepted proposal or invitation becomes a single tracked project.'],
            ].map(([t, b]) => (
              <li key={t} className="border-t border-mist/20 pt-4">
                <p className="text-[18px] font-bold tracking-[-0.02em]">{t}</p>
                <p className="mt-1 text-[14px] text-mist">{b}</p>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {context && <Alert tone="info" className="mb-6">{context.text}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <fieldset>
          <legend className="sr-only">How will you use UNIO?</legend>
          <div className="flex flex-col gap-2">
            {ROLES.map(({ value, title, body, Icon }) => {
              const on = role === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-md border bg-white p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-navy ${
                    on ? 'border-2 border-navy bg-soft p-[13px]' : 'border-line2 hover:border-navy'
                  }`}
                >
                  <input type="radio" value={value} className="sr-only" {...register('role')} />
                  <span className={`grid size-[38px] shrink-0 place-items-center rounded-full border ${on ? 'border-navy bg-navy text-white' : 'border-line2 text-navy'}`}>
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold">{title}</span>
                    <span className="block text-[13px] text-steel">{body}</span>
                  </span>
                  {on && (
                    <span className="grid size-[22px] place-items-center rounded-full bg-navy text-white">
                      <Check className="size-3" strokeWidth={2.4} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {formState.errors.role && (
            <p role="alert" className="mt-1.5 text-[13px] text-att">
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
      <p className="mt-5 text-center text-[13.5px] text-steel">
        Already have an account?{' '}
        <Link to={loginHref} className="font-bold text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
