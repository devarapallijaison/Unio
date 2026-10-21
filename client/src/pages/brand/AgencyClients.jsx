import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, LayoutGrid, Mail, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ClientBadge, useClientColor } from '../../components/agency/ClientBadge.jsx';
import { ConfirmAction } from '../../components/dashboard/Kit.jsx';
import { PageHeader } from '../../components/layout/Layouts.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Dialog } from '../../components/ui/Dialog.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input, Select } from '../../components/ui/Form.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { labelOf, useTaxonomy } from '../../hooks/useTaxonomy.js';
import { endpoints } from '../../services/api.js';

/* v9 A2 — agency clients: colour tag, brand-side counts (all real), approver. */

function ClientCard({ client, taxonomy, onEdit }) {
  const { bg, fg } = useClientColor(client.color);
  const stats = [
    [client.campaigns, 'Campaigns', `/brand/campaigns?client=${client._id}`],
    [client.projects, 'Projects', `/brand/projects?client=${client._id}`],
    [client.awaiting, 'Awaiting', `/brand/approvals?client=${client._id}`],
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-[18px]" style={{ background: bg, color: fg }}>
        <ClientBadge client={client} size="lg" className="!bg-transparent" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] tracking-[-0.02em]">{client.name}</h2>
          <span className="text-[13px]">{client.industry ? labelOf(taxonomy, 'specializations', client.industry) : 'No industry set'}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onEdit(client)} aria-label={`Edit ${client.name}`} className="!text-current">
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-3 border-b border-line">
        {stats.map(([n, label, to]) => (
          <Link key={label} to={to} className="border-l border-line px-5 py-3.5 first:border-l-0 hover:bg-soft">
            <dd className="text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">{n}</dd>
            <dt className="mt-1 text-[13px] text-slate">{label}</dt>
          </Link>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3 text-[13px]">
        <span className="text-steel">Approver</span>
        <b>{client.approverName || '—'}</b>
        <span className="flex-1" />
        {client.approverName ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-white px-2 py-0.5 text-slate">
            <Mail className="size-3" aria-hidden /> Approval link on
          </span>
        ) : (
          <span className="rounded-sm border border-line bg-white px-2 py-0.5 text-slate">No approver yet</span>
        )}
      </div>
    </Card>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ClientForm({ client, taxonomy, onDone }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState({
    name: client?.name ?? '',
    industry: client?.industry ?? '',
    color: client?.color ?? '',
    approverName: client?.approverName ?? '',
    approverEmail: client?.approverEmail ?? '',
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['mine', 'clients'] });
    qc.invalidateQueries({ queryKey: ['mine', 'brand-campaigns'] });
    qc.invalidateQueries({ queryKey: ['mine', 'projects'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: v.name.trim(),
        industry: v.industry || null,
        ...(v.color ? { color: v.color } : {}),
        approverName: v.approverName.trim(),
        approverEmail: v.approverEmail.trim(),
      };
      return client ? endpoints.brand.updateClient(client._id, body) : endpoints.brand.createClient(body);
    },
    onSuccess: () => {
      refresh();
      toast.success(client ? 'Client updated.' : 'Client added.');
      onDone();
    },
    onError: (err) => {
      const field = err.details?.[0]?.field;
      if (field) setErrors({ [field]: err.details[0].message });
    },
  });
  const archive = useMutation({
    mutationFn: () => endpoints.brand.archiveClient(client._id),
    onSuccess: () => {
      refresh();
      toast.success('Client archived. Their past briefs and projects stay.');
      onDone();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (v.name.trim().length < 2) next.name = 'Enter the client’s name';
    if (v.approverEmail.trim() && !EMAIL.test(v.approverEmail.trim())) next.approverEmail = 'Enter a valid email address';
    setErrors(next);
    if (!Object.keys(next).length) save.mutate();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Input label="Client name" required value={v.name} onChange={set('name')} error={errors.name} placeholder="e.g. Verdant Skin Co." />
      <Select label="Industry" value={v.industry} onChange={set('industry')}>
        <option value="">Choose…</option>
        {taxonomy?.specializations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
      <fieldset>
        <legend className="mb-1.5 text-[13.5px] font-semibold">Colour tag</legend>
        <div className="flex flex-wrap gap-2">
          {(taxonomy?.clientColors ?? []).map((c) => {
            const on = (v.color || client?.color) === c.id;
            return (
              <label key={c.id} className="cursor-pointer">
                <input type="radio" name="color" value={c.id} checked={on} onChange={set('color')} className="sr-only peer" />
                <span
                  className="grid size-10 place-items-center rounded-[10px] text-[12px] font-extrabold ring-offset-2 peer-checked:ring-2 peer-checked:ring-navy peer-focus-visible:ring-2 peer-focus-visible:ring-navy"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {(v.name.trim()[0] ?? 'A').toUpperCase()}
                  <span className="sr-only"> {c.id}</span>
                </span>
              </label>
            );
          })}
        </div>
        {!client && !v.color && <p className="mt-1.5 text-[12.5px] text-steel">Leave it and we pick the next free colour.</p>}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Approver name" note="Optional" value={v.approverName} onChange={set('approverName')} placeholder="Who signs off?" />
        <Input label="Approver email" note="Optional" type="email" value={v.approverEmail} onChange={set('approverEmail')} error={errors.approverEmail} placeholder="name@client.com" />
      </div>
      <p className="text-[12.5px] text-steel">Approval links are shared by you. UNIO does not email your client.</p>
      {save.error && !save.error.details?.length && <Alert tone="error">{save.error.message}</Alert>}
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        {client ? (
          <ConfirmAction
            title={`Archive ${client.name}?`}
            body="They leave the client switcher and “New brief for…”. Existing briefs and projects keep their client."
            confirmLabel="Archive"
            variant="danger"
            pending={archive.isPending}
            error={archive.error}
            onConfirm={() => archive.mutateAsync()}
            trigger={(open) => (
              <Button variant="ghost" onClick={open}>
                <Archive className="size-4" /> Archive client
              </Button>
            )}
          />
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {client ? 'Save client' : 'Add client'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default function AgencyClients() {
  useDocumentTitle('Clients');
  const { data: taxonomy } = useTaxonomy();
  const query = useQuery({ queryKey: ['mine', 'clients'], queryFn: endpoints.brand.clients });
  const [editing, setEditing] = useState(null); // null | {} | { client }
  const clients = query.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Clients"
        description="Each client gets a colour tag and an approver. Briefs and projects are tagged by client."
        actions={
          <Button onClick={() => setEditing({})}>
            <Plus className="size-4" /> Add client
          </Button>
        }
      />
      <div className="mt-6">
        {query.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : clients.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No clients yet" action={<Button onClick={() => setEditing({})}>Add your first client</Button>}>
            Add the brands you work for, then start a brief for each one.
          </EmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {clients.map((c) => (
              <ClientCard key={c._id} client={c} taxonomy={taxonomy} onEdit={(client) => setEditing({ client })} />
            ))}
          </div>
        )}
      </div>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.client ? `Edit ${editing.client.name}` : 'Add a client'} description="Name, colour and who approves work.">
        {editing && <ClientForm key={editing.client?._id ?? 'new'} client={editing.client} taxonomy={taxonomy} onDone={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}
