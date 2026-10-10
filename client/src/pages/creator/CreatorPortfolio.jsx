import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { Tag } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Checkbox, Input, Select, TagInput, Textarea, applyServerErrors } from '../../components/ui/Form.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { VerificationBadge } from '../../components/verification/VerificationBadge.jsx';
import { Link } from 'react-router';
import { CATEGORIES, TOOLS } from '../../lib/taxonomy.js';
import { endpoints } from '../../services/api.js';

const url = z.string().trim().url('Enter a full URL starting with https://');
const schema = z.object({
  title: z.string().trim().min(2, 'Give this piece a title').max(160),
  description: z.string().trim().max(1000),
  mediaType: z.enum(['image', 'video']),
  mediaUrl: url,
  thumbnailUrl: z.union([z.literal(''), url]),
  tools: z.array(z.string()).max(30),
  category: z.string().trim().max(80),
  featured: z.boolean(),
});

const EMPTY = { title: '', description: '', mediaType: 'image', mediaUrl: '', thumbnailUrl: '', tools: [], category: '', featured: false };

function PortfolioForm({ item, onDone }) {
  const qc = useQueryClient();
  const toast = useToast();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: item ? { ...EMPTY, ...item, thumbnailUrl: item.thumbnailUrl ?? '' } : EMPTY });
  const { register, handleSubmit, control, formState, setError, watch } = form;

  const save = useMutation({
    mutationFn: (values) => {
      const body = { ...values };
      return item ? endpoints.creator.updatePortfolio(item._id, body) : endpoints.creator.addPortfolio(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine', 'portfolio'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success(item ? 'Portfolio piece updated.' : 'Portfolio piece added.');
      onDone();
    },
    onError: (err) => applyServerErrors(err, setError),
  });

  const isVideo = watch('mediaType') === 'video';

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-5">
      <Input label="Title" required error={formState.errors.title?.message} {...register('title')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="Media type" {...register('mediaType')}>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </Select>
        <Select label="Category" {...register('category')}>
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <Input
        label={isVideo ? 'Video URL' : 'Image URL'}
        required
        placeholder="https://"
        hint="Upload the file to a media host (e.g. Cloudinary) and paste the link. UNIO stores only the URL."
        error={formState.errors.mediaUrl?.message}
        {...register('mediaUrl')}
      />
      <Input
        label={isVideo ? 'Thumbnail URL (recommended)' : 'Thumbnail URL (optional)'}
        placeholder="https://"
        error={formState.errors.thumbnailUrl?.message}
        {...register('thumbnailUrl')}
      />
      <Textarea label="Description" rows={3} error={formState.errors.description?.message} {...register('description')} />
      <Controller name="tools" control={control} render={({ field }) => <TagInput label="Tools used" value={field.value} onChange={field.onChange} suggestions={TOOLS} />} />
      <Controller
        name="featured"
        control={control}
        render={({ field }) => (
          <Checkbox label="Feature this piece" description="Featured pieces appear first on your profile and in search previews." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
        )}
      />
      {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 border-t border-beige/60 pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {item ? 'Save changes' : 'Add to portfolio'}
        </Button>
      </div>
    </form>
  );
}

function DeleteButton({ item }) {
  const qc = useQueryClient();
  const toast = useToast();
  const del = useMutation({
    mutationFn: () => endpoints.creator.deletePortfolio(item._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mine', 'portfolio'] });
      qc.invalidateQueries({ queryKey: ['pub'] });
      toast.success('Portfolio piece deleted.');
    },
  });
  return (
    <ConfirmAction
      title="Delete this piece?"
      body={`“${item.title}” will be removed from your public profile. The media file itself stays wherever it’s hosted.`}
      confirmLabel="Delete"
      variant="danger"
      pending={del.isPending}
      error={del.error}
      onConfirm={() => del.mutateAsync()}
      trigger={(open) => (
        <Button variant="ghost" size="sm" onClick={open} aria-label={`Delete ${item.title}`}>
          <Trash2 className="size-4" />
        </Button>
      )}
    />
  );
}

export default function CreatorPortfolio() {
  useDocumentTitle('Portfolio');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const query = useQuery({ queryKey: ['mine', 'portfolio'], queryFn: endpoints.creator.portfolio });
  const verifications = useQuery({ queryKey: ['mine', 'verifications'], queryFn: endpoints.creator.verifications });
  const statusFor = (id) => verifications.data?.find((v) => v.portfolioItemId === id)?.status;

  return (
    <>
      <PageHeader
        eyebrow="Work"
        title="Portfolio"
        description="Add your strongest pieces. Brands look at these before anything else."
        actions={
          <Button onClick={() => setEditing('new')}>
            <ImagePlus className="size-4" /> Add piece
          </Button>
        }
      />
      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={ImagePlus} title="Your portfolio is empty" action={<Button onClick={() => setEditing('new')}>Add your first piece</Button>}>
          Upload images or videos to a media host, then add the links here with the tools you used.
        </EmptyState>
      ) : (
        <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {query.data.map((item) => (
            <li key={item._id}>
              <MediaFrame item={item} aspect="aspect-[4/5]" />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {item.featured && <Star className="size-3.5 shrink-0 fill-forest text-forest" aria-label="Featured" />}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <p className="text-[13px] text-muted">{[item.category, item.mediaType].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(item)} aria-label={`Edit ${item.title}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <DeleteButton item={item} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <VerificationBadge status={statusFor(item._id) ?? 'SELF_REPORTED'} />
                {statusFor(item._id) !== 'VERIFIED' && (
                  <Link to={`/creator/verification?portfolio=${item._id}`} className="inline-flex items-center gap-1 text-[12px] text-forest hover:underline">
                    <ShieldCheck className="size-3.5" /> {statusFor(item._id) ? 'Manage evidence' : 'Verify this piece'}
                  </Link>
                )}
              </div>
              {item.tools?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tools.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a portfolio piece' : 'Edit portfolio piece'}>
        {editing && <PortfolioForm key={editing === 'new' ? 'new' : editing._id} item={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}
