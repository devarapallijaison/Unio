import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { endpoints } from '../../services/api.js';

const optionalUrl = z.union([z.literal(''), z.string().trim().url('Enter a full URL starting with https://')]);
const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter at least 2 characters').max(160),
  industry: z.string().trim().max(80),
  websiteUrl: optionalUrl,
  logoUrl: optionalUrl,
  description: z.string().trim().max(2000),
});

const toForm = (p) => ({
  companyName: p.companyName ?? '',
  industry: p.industry ?? '',
  websiteUrl: p.websiteUrl ?? '',
  logoUrl: p.logoUrl ?? '',
  description: p.description ?? '',
});

export default function BrandProfile() {
  useDocumentTitle('Brand profile');
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const profile = useQuery({ queryKey: ['mine', 'brand-profile'], queryFn: endpoints.brand.profile });
  const { register, handleSubmit, reset, formState, setError } = useForm({ resolver: zodResolver(schema), defaultValues: toForm({}) });

  useEffect(() => {
    if (profile.data) reset(toForm(profile.data));
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: endpoints.brand.updateProfile,
    onSuccess: (data) => {
      qc.setQueryData(['mine', 'brand-profile'], data);
      qc.invalidateQueries({ queryKey: ['pub'] });
      refresh();
      reset(toForm(data));
      toast.success('Brand profile saved.');
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  if (profile.isLoading) return <PageLoader />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  return (
    <>
      <PageHeader eyebrow="Profile" title="Brand profile" description="Shown to creators on your campaign pages and invitations." />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
        <section className="grid gap-5 rounded-lg border border-line/70 bg-white p-6 sm:grid-cols-2">
          <Input label="Company name" required error={formState.errors.companyName?.message} {...register('companyName')} />
          <Input label="Industry" placeholder="e.g. Beauty" error={formState.errors.industry?.message} {...register('industry')} />
          <Input label="Website" placeholder="https://" error={formState.errors.websiteUrl?.message} {...register('websiteUrl')} />
          <Input label="Logo URL" placeholder="https://" error={formState.errors.logoUrl?.message} {...register('logoUrl')} />
          <Textarea className="sm:col-span-2" label="About the brand" rows={5} error={formState.errors.description?.message} {...register('description')} />
        </section>
        {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => reset(toForm(profile.data))} disabled={!formState.isDirty}>
            Discard
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!formState.isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </>
  );
}
