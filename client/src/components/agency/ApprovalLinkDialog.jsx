import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { Alert } from '../ui/Feedback.jsx';
import { useToast } from '../ui/Toast.jsx';
import { formatDate } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';

/** Create an approval link for one version and show its URL once (only a hash is kept on the server). */
export function useApprovalLink(projectId) {
  const qc = useQueryClient();
  const [created, setCreated] = useState(null);
  const create = useMutation({
    mutationFn: (deliverableId) => endpoints.projects.createApprovalLink(projectId, { deliverableId }),
    onSuccess: (data) => {
      setCreated(data);
      qc.invalidateQueries({ queryKey: ['mine', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['mine', 'clients'] });
      qc.invalidateQueries({ queryKey: ['mine', 'project', projectId] });
    },
  });
  return { create, created, clear: () => setCreated(null) };
}

export function ApprovalLinkDialog({ link, onClose }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  if (!link) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success('Link copied.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.');
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Approval link ready"
      description={`For ${link.approverName ?? 'your client'} · v${link.versionNumber} · works once, until ${formatDate(link.expiresAt)}`}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-line2 bg-soft p-2.5">
          <Link2 className="ml-1 size-4 shrink-0 text-steel" aria-hidden />
          <input readOnly value={link.url} aria-label="Approval link" onFocus={(e) => e.target.select()} className="min-w-0 flex-1 bg-transparent font-mono text-[12.5px] outline-none" />
          <Button size="sm" onClick={copy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <Alert tone="info">
          UNIO does not send email: share this link with your client yourself. It is shown only now. If you lose it, make a new one (the old one then stops working).
        </Alert>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
