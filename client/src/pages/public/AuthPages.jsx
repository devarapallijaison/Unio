import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Briefcase, Check, Eye, EyeOff, ImageIcon, LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Feedback.jsx';
import { Input, Select, applyServerErrors } from '../../components/ui/Form.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useTaxonomy } from '../../hooks/useTaxonomy.js';
import { safeReturnTo } from '../../lib/returnTo.js';

/** Explains why the user is being asked to sign in, based on the preserved intent. */
function intentContext(returnTo) {
  if (!returnTo) return null;
  if (returnTo.includes('intent=apply')) return { text: 'Sign in with a creator account to apply to this campaign. You’ll review your application before it’s sent.', role: 'creator' };
  if (returnTo.includes('intent=invite')) return { text: 'Sign in with a brand account to invite this creator. You’ll choose a campaign before anything is sent.', role: 'brand' };
  return { text: 'Sign in to continue where you left off.' };
}

/** Decorative fanned cards on the dark side (Steel fallback art — no real work is implied). v9 .au-art */
function ArtFan() {
  return (
    <div className="mt-auto grid translate-y-[30px] -rotate-[4deg] grid-cols-3 gap-3 pr-9" aria-hidden>
      {['auth-a', 'auth-c', 'auth-e'].map((seed, i) => (
        <div key={seed} className={`overflow-hidden rounded-xl shadow-pop ${i === 1 ? '-translate-y-[30px]' : ''}`}>
          <MediaFrame item={{ _id: seed }} aspect="aspect-[9/16]" className="rounded-none" showLabel={false} hover={false} />
        </div>
      ))}
    </div>
  );
}

/** Split screen (v9 P7/P8 .auth): dark statement + art on the left, form on the right. */
function AuthShell({ title, subtitle, children, aside }) {
  return (
    <main id="main" className="grid min-h-dvh bg-white lg:grid-cols-2">
      <div className="relative hidden flex-col gap-7 overflow-hidden bg-[linear-gradient(160deg,var(--color-ink),var(--color-navy)_60%,var(--color-slate))] pl-9 pt-9 lg:flex">
        <Link to="/" aria-label="UNIO home" className="self-start">
          <Logo onDark className="h-[30px]" />
        </Link>
        <div className="mt-10 flex max-w-[440px] flex-col gap-3.5 pr-9">{aside}</div>
        <ArtFan />
      </div>
      <div className="flex justify-center px-4 py-10 sm:px-5 lg:py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-4">
          <Link to="/" aria-label="UNIO home" className="mb-4 inline-block self-start lg:hidden">
            <Logo className="h-7" />
          </Link>
          <h1 className="text-[34px]">{title}</h1>
          {subtitle && <p className="-mt-2 text-steel">{subtitle}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}

/** Left-panel copy: eyebrow + one honest line (no invented testimonials). */
function Statement({ eyebrow, line, sub }) {
  return (
    <>
      <span className="eyebrow text-mist">{eyebrow}</span>
      <p className="text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-white">{line}</p>
      {sub && <p className="text-[13px] text-bone">{sub}</p>}
    </>
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
        <Statement
          eyebrow="How UNIO works"
          line="A good brief and the right creator is most of the work."
          sub="UNIO keeps briefs, proposals and deliverables in one place for both sides."
        />
      }
    >
      {context && <Alert tone="info">{context.text}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
      <p className="text-center text-[12.5px] text-steel">
        New here?{' '}
        <Link to={registerHref} className="font-bold text-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <Alert tone="success">Reviewers sign in here too — their accounts are created by UNIO, not on the join page.</Alert>
    </AuthShell>
  );
}

/* ---------- Join (v9 P8): fields differ by role (guide §6.1) ---------- */

const password = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');
const name = z.string().trim().min(2, 'Enter at least 2 characters').max(120);
const email = z.string().trim().email('Enter a valid email address');
const optional = (max) => z.string().trim().max(max).optional().or(z.literal(''));

const SCHEMAS = {
  creator: z.object({
    name,
    displayName: optional(120),
    email,
    category: z.string().min(1, 'Choose what kind of creator you are'),
    city: z.string().trim().min(2, 'Enter your city').max(120),
    password,
  }),
  brand: z.object({
    name,
    jobTitle: z.string().trim().min(2, 'Enter your role').max(80),
    companyName: z.string().trim().min(2, 'Enter your brand or company name').max(160),
    industry: z.string().min(1, 'Choose your industry'),
    email,
    websiteUrl: optional(2048),
    password,
  }),
  agency: z.object({
    name,
    jobTitle: z.string().trim().min(2, 'Enter your role').max(80),
    companyName: z.string().trim().min(2, 'Enter your agency name').max(160),
    teamSize: z.string().min(1, 'Choose your team size'),
    email,
    websiteUrl: z.string().trim().min(3, 'Enter your agency website').max(2048),
    firstClientName: optional(120),
    password,
  }),
};

/** What the server receives for each role (role/accountType are fixed here, never typed). */
function toBody(kind, v) {
  if (kind === 'creator') {
    return { role: 'creator', name: v.name, displayName: v.displayName, email: v.email, category: v.category, city: v.city, password: v.password };
  }
  const base = { role: 'brand', name: v.name, jobTitle: v.jobTitle, companyName: v.companyName, email: v.email, websiteUrl: v.websiteUrl, password: v.password };
  return kind === 'agency'
    ? { ...base, accountType: 'agency', teamSize: v.teamSize, firstClientName: v.firstClientName }
    : { ...base, accountType: 'brand', industry: v.industry };
}

const ROLES = {
  creator: {
    title: 'Creator',
    body: 'Make AI content and get hired.',
    Icon: ImageIcon,
    button: 'Create creator account',
    aside: ['For creators', 'Show how you made it, not just what you made.', 'Your tool chain, versions and verified tools travel with every piece.'],
    next: [
      ['Build your profile', 'Skills, tools, industries'],
      ['Add 3 pieces', 'With how each was made'],
      ['Verify one tool', 'Get your first badge'],
    ],
    footer: 'A creator account can’t become a brand later.',
  },
  brand: {
    title: 'Brand',
    body: 'Hire creators for your own brand.',
    Icon: Briefcase,
    button: 'Create brand account',
    aside: ['For brands', 'Say it in one line. We’ll write the brief.', 'Formats, style, budget and rights — every field editable before anything is published.'],
    next: [
      ['Add your brand kit', 'Colours, tone, never-do list'],
      ['Write a brief with AI', 'One line is enough'],
      ['Pick from your matches', 'Score + reasons'],
    ],
    footer: 'You can switch between Brand and Agency later in settings.',
  },
  agency: {
    title: 'Agency',
    body: 'Run creator work for many clients.',
    Icon: LayoutGrid,
    button: 'Create agency account',
    aside: ['For agencies', 'Every client, one workspace.', 'Brief, hire and review creator work for each client without mixing them up.'],
    next: [
      ['Add your clients', 'Each gets a tag + approver'],
      ['Brief for a client', 'AI fills it in'],
      ['Send approval links', 'No login for clients'],
    ],
    footer: 'You can switch between Brand and Agency later in settings.',
  },
};

function RoleCard({ kind, selected, onSelect }) {
  const { title, body, Icon } = ROLES[kind];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(kind)}
      className={`relative flex w-full items-center gap-3 rounded-md border bg-white px-3.5 py-3 text-left transition-colors ${
        selected ? 'border-navy bg-soft shadow-[inset_0_0_0_2px_var(--color-navy)]' : 'border-line2 hover:border-navy'
      }`}
    >
      <span className={`grid size-[38px] shrink-0 place-items-center rounded-full border ${selected ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy'}`}>
        <Icon className="size-4" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <b className="block text-[14px]">{title}</b>
        <small className="text-[12.5px] text-steel">{body}</small>
      </span>
      {selected && (
        <span className="absolute right-3 top-1/2 grid size-[22px] -translate-y-1/2 place-items-center rounded-full bg-navy text-white">
          <Check className="size-3" strokeWidth={2.4} />
        </span>
      )}
    </button>
  );
}

const pair = 'grid grid-cols-1 gap-3 sm:grid-cols-2';

function RoleFields({ kind, register, errors, taxonomy }) {
  const err = (k) => errors[k]?.message;
  const loading = !taxonomy;
  if (kind === 'creator') {
    return (
      <>
        <div className={pair}>
          <Input label="Full name" autoComplete="name" error={err('name')} {...register('name')} />
          <Input label="Creator name" note="Optional · shown on your profile" placeholder="e.g. meera.makes" error={err('displayName')} {...register('displayName')} />
        </div>
        <Input label="Email" note="Any email is fine" type="email" autoComplete="email" error={err('email')} {...register('email')} />
        <div className={pair}>
          <Select label="What kind of creator are you?" disabled={loading} error={err('category')} {...register('category')}>
            <option value="">{loading ? 'Loading…' : 'Choose one'}</option>
            {taxonomy?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label.replace(/s$/, '')}
              </option>
            ))}
          </Select>
          <Input label="City" autoComplete="address-level2" error={err('city')} {...register('city')} />
        </div>
      </>
    );
  }
  const agency = kind === 'agency';
  return (
    <>
      <div className={pair}>
        <Input label="Your name" autoComplete="name" error={err('name')} {...register('name')} />
        <Input label="Your role" autoComplete="organization-title" placeholder={agency ? 'e.g. Founder' : 'e.g. Marketing manager'} error={err('jobTitle')} {...register('jobTitle')} />
      </div>
      <div className={pair}>
        <Input label={agency ? 'Agency name' : 'Brand / company name'} autoComplete="organization" error={err('companyName')} {...register('companyName')} />
        {agency ? (
          <Select label="Team size" disabled={loading} error={err('teamSize')} {...register('teamSize')}>
            <option value="">{loading ? 'Loading…' : 'Choose one'}</option>
            {taxonomy?.teamSizes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        ) : (
          <Select label="Industry" disabled={loading} error={err('industry')} {...register('industry')}>
            <option value="">{loading ? 'Loading…' : 'Choose one'}</option>
            {taxonomy?.specializations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </div>
      <Input
        label="Work email"
        note={agency ? 'Use your agency email' : 'Use your company email — it helps creators trust your brief'}
        type="email"
        autoComplete="email"
        error={err('email')}
        {...register('email')}
      />
      <Input label={agency ? 'Agency website' : 'Website'} note={agency ? undefined : 'Optional'} placeholder="yourbrand.in" autoComplete="url" error={err('websiteUrl')} {...register('websiteUrl')} />
      {agency && (
        <Input label="First client" note="Optional · you can add more after sign-up" placeholder="e.g. a client brand name" error={err('firstClientName')} {...register('firstClientName')} />
      )}
    </>
  );
}

const ROLE_PARAM = { creator: 'creator', brand: 'brand', agency: 'agency' };

export function RegisterPage() {
  useDocumentTitle('Join UNIO');
  const { register: signUp } = useAuth();
  const taxonomy = useTaxonomy();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const context = intentContext(returnTo);
  const [kind, setKind] = useState(context?.role ?? ROLE_PARAM[params.get('role')] ?? 'brand');
  const role = ROLES[kind];

  const form = useForm({
    // Resolver follows the selected role so only that role's fields are validated.
    resolver: (values, ctx, options) => zodResolver(SCHEMAS[kind])(values, ctx, options),
    shouldUnregister: true,
  });
  const { register, handleSubmit, formState, setError, clearErrors } = form;

  const choose = (k) => {
    setKind(k);
    clearErrors();
    signUp.reset();
  };
  const onSubmit = (values) => signUp.mutate(toBody(kind, values), { onError: (err) => applyServerErrors(err, setError) });
  const loginHref = `/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`;
  const [eyebrow, line, sub] = role.aside;

  return (
    <AuthShell title="Join UNIO" subtitle="Pick how you’ll use UNIO." aside={<Statement eyebrow={eyebrow} line={line} sub={sub} />}>
      {context && <Alert tone="info">{context.text}</Alert>}
      <div role="radiogroup" aria-label="How will you use UNIO?" className="flex flex-col gap-2">
        {Object.keys(ROLES).map((k) => (
          <RoleCard key={k} kind={k} selected={k === kind} onSelect={choose} />
        ))}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div key={kind} className="flex animate-rise flex-col gap-3 border-t border-line pt-4 [animation-duration:250ms]">
          <RoleFields kind={kind} register={register} errors={formState.errors} taxonomy={taxonomy.data} />
          <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters, with a letter and a number" error={formState.errors.password?.message} {...register('password')} />
        </div>
        {taxonomy.error && <Alert tone="error">We couldn’t load the sign-up options. Refresh the page to try again.</Alert>}
        {signUp.error && !signUp.error.details?.length && <Alert tone="error">{signUp.error.message}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={signUp.isPending} disabled={!taxonomy.data}>
          {role.button} <ArrowRight className="size-4" />
        </Button>
      </form>
      <div className="flex flex-col gap-2.5 rounded-md border border-line bg-soft px-3.5 py-3">
        <span className="eyebrow">After sign-up · 3 quick steps</span>
        <ol className="grid grid-cols-3 gap-2">
          {role.next.map(([title, body], i) => (
            <li key={title} className="flex flex-col gap-0.5 text-[12.5px]">
              <span className="mb-1 grid size-5 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
              <b>{title}</b>
              <span className="text-[11.5px] text-steel">{body}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-center text-[12.5px] text-steel">
        {role.footer} Have an account?{' '}
        <Link to={loginHref} className="font-bold text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
