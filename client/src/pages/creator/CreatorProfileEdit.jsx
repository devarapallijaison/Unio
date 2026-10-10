import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button, ButtonLink } from '../../components/ui/Button.jsx';
import { Alert, ErrorState, PageLoader } from '../../components/ui/Feedback.jsx';
import { Input, Select, TagInput, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { CATEGORIES, SKILLS, TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const optionalUrl = z.union([z.literal(''), z.string().trim().url('Enter a full URL starting with https://')]);

const schema = z.object({
  displayName: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  bio: z.string().trim().max(2000, 'Keep your bio under 2000 characters'),
  location: z.string().trim().max(120),
  photoUrl: optionalUrl,
  skills: z.array(z.string()).max(30),
  tools: z.array(z.string()).max(30),
  specialties: z.array(z.string()).max(30),
  startingPrice: z.union([z.literal(''), z.coerce.number().min(0, 'Price can’t be negative').max(100_000_000)]),
  availability: z.enum(['available', 'busy', 'unavailable']),
});

function toForm(p) {
  return {
    displayName: p.displayName ?? '',
    bio: p.bio ?? '',
    location: p.location ?? '',
    photoUrl: p.photoUrl ?? '',
    skills: p.skills ?? [],
    tools: p.tools ?? [],
    specialties: p.specialties ?? [],
    startingPrice: p.startingPrice ?? '',
    availability: p.availability ?? 'available',
  };
}

export default function CreatorProfileEdit() {
  useDocumentTitle('Edit profile');
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const profile = useQuery({ queryKey: ['mine', 'creator-profile'], queryFn: endpoints.creator.profile });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toForm({}) });
  const { register, handleSubmit, control, reset, formState, setError, watch } = form;

  useEffect(() => {
    if (profile.data) reset(toForm(profile.data));
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (values) =>
      endpoints.creator.updateProfile({ ...values, startingPrice: values.startingPrice === '' ? null : Number(values.startingPrice) }),
    onSuccess: (data) => {
      qc.setQueryData(['mine', 'creator-profile'], data);
      qc.invalidateQueries({ queryKey: ['pub'] });
      refresh();
      reset(toForm(data));
      toast.success('Profile saved.');
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  if (profile.isLoading) return <PageLoader label="Loading your profile" />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.refetch} />;

  const name = watch('displayName');
  const photo = watch('photoUrl');

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Edit your profile"
        description="This is what brands see first. Be specific about the work you do and the tools you use."
        actions={
          <ButtonLink to={`/creators/${profile.data._id}`} variant="secondary">
            View public profile
          </ButtonLink>
        }
      />
      <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
        <section className="grid gap-6 rounded-lg border border-beige/70 bg-white p-6 md:grid-cols-[160px_1fr]">
          <div className="flex flex-col items-start gap-3">
            <Avatar name={name} src={photo} size="xl" />
            <p className="text-[12px] text-muted">Initials are shown until you add a photo URL.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Display name" required error={formState.errors.displayName?.message} {...register('displayName')} />
            <Input label="Location" placeholder="City, Country" error={formState.errors.location?.message} {...register('location')} />
            <Input
              className="sm:col-span-2"
              label="Photo URL"
              placeholder="https://"
              hint="Link to an image hosted elsewhere (e.g. Cloudinary)."
              error={formState.errors.photoUrl?.message}
              {...register('photoUrl')}
            />
            <Textarea
              className="sm:col-span-2"
              label="Bio"
              rows={5}
              hint="Two or three sentences: what you make, for whom, and how."
              error={formState.errors.bio?.message}
              {...register('bio')}
            />
          </div>
        </section>

        <section className="grid gap-5 rounded-lg border border-beige/70 bg-white p-6">
          <Controller name="skills" control={control} render={({ field }) => <TagInput label="Skills" value={field.value} onChange={field.onChange} suggestions={SKILLS} />} />
          <Controller name="tools" control={control} render={({ field }) => <TagInput label="AI tools" value={field.value} onChange={field.onChange} suggestions={TOOLS} />} />
          <Controller
            name="specialties"
            control={control}
            render={({ field }) => <TagInput label="Specialties / industries" value={field.value} onChange={field.onChange} suggestions={CATEGORIES} />}
          />
        </section>

        <section className="grid gap-5 rounded-lg border border-beige/70 bg-white p-6 sm:grid-cols-2">
          <Input
            label="Starting price"
            type="number"
            min="0"
            prefix="₹"
            hint="The lowest project fee you usually accept."
            error={formState.errors.startingPrice?.message}
            {...register('startingPrice')}
          />
          <Select label="Availability" {...register('availability')}>
            <option value="available">Available for projects</option>
            <option value="busy">Limited availability</option>
            <option value="unavailable">Not taking work</option>
          </Select>
        </section>

        {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}

        <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t border-beige/70 bg-ivory/95 px-4 py-4 sm:mx-0 sm:rounded-lg sm:border sm:px-5">
          {formState.isDirty && <span className="mr-auto text-[13px] text-muted">Unsaved changes</span>}
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
