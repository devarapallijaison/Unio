import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { formatDate, formatINR } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { ConfirmAction } from '../dashboard/Kit.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { DemoBadge, StatusPill, Tag } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { useToast } from '../ui/Toast.jsx';

/** A creator's proposal as the brand sees it, with accept/reject review actions. */
export function ApplicationCard({ application, showCampaign = false }) {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const c = application.creator;

  const review = useMutation({
    mutationFn: (status) => endpoints.brand.reviewApplication(application._id, status),
    onSuccess: (data, status) => {
      qc.invalidateQueries({ queryKey: ['mine'] });
      if (status === 'accepted') {
        toast.success(`${c?.displayName ?? 'Creator'} is hired — project created.`);
        if (data.project) navigate(`/projects/${data.project._id}`);
      } else {
        toast.success('Application marked as not selected.');
      }
    },
  });

  return (
    <li className="rounded-lg border border-beige/70 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={c?.displayName ?? '?'} src={c?.photoUrl} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/creators/${application.creatorId}`} className="font-display text-xl hover:text-forest">
                {c?.displayName ?? 'Creator'}
              </Link>
              {c?.isDemo && <DemoBadge label="Demo" />}
            </div>
            <p className="text-[13px] text-muted">
              {[c?.location, `Applied ${formatDate(application.submittedAt)}`].filter(Boolean).join(' · ')}
            </p>
            {showCampaign && application.campaign && (
              <Link to={`/brand/campaigns/${application.campaignId}/applicants`} className="mt-1 block text-[13px] text-forest hover:underline">
                {application.campaign.title}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <StatusPill status={application.status} />
          <p className="font-mono text-sm">{application.proposedPrice != null ? formatINR(application.proposedPrice) : 'Price not given'}</p>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line border-l-2 border-sage pl-4 text-[15px] leading-relaxed text-ink/85">{application.proposal}</p>

      {(c?.tools?.length ?? 0) > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {c.tools.slice(0, 6).map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}

      {application.status === 'pending' && (
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-beige/60 pt-4">
          <ConfirmAction
            title="Mark as not selected?"
            body={`${c?.displayName ?? 'The creator'} will see that this application wasn’t selected.`}
            confirmLabel="Not selected"
            variant="danger"
            pending={review.isPending && review.variables === 'rejected'}
            error={review.variables === 'rejected' ? review.error : null}
            onConfirm={() => review.mutateAsync('rejected')}
            trigger={(open) => (
              <Button variant="ghost" size="sm" onClick={open}>
                Not selected
              </Button>
            )}
          />
          <ConfirmAction
            title={`Hire ${c?.displayName ?? 'this creator'}?`}
            body="Accepting creates a project with this campaign’s deliverables. You can still accept other applicants."
            confirmLabel="Accept and create project"
            pending={review.isPending && review.variables === 'accepted'}
            error={review.variables === 'accepted' ? review.error : null}
            onConfirm={() => review.mutateAsync('accepted')}
            trigger={(open) => (
              <Button size="sm" onClick={open}>
                Accept proposal
              </Button>
            )}
          />
        </div>
      )}
    </li>
  );
}
