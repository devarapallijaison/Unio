import { ButtonLink } from '../../components/ui/Button.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/** v9 P9. `what` = "creator" | "campaign" when a specific record is missing or not public. */
export default function NotFoundPage({ what }) {
  useDocumentTitle('Not found');
  const heading = what ? `This ${what} isn’t available.` : 'This page wasn’t made on UNIO.';
  const body = what
    ? `It may have been removed, or it isn’t public yet. Try browsing ${what === 'campaign' ? 'open campaigns' : 'other creators'} instead.`
    : 'The link may be old, or the page may have been removed.';
  return (
    <div className="container-page flex min-h-[60vh] flex-col justify-center py-20">
      <p className="font-mono text-[72px] leading-none text-line2 sm:text-[96px]" aria-hidden>
        404
      </p>
      <h1 className="mt-10 text-[30px] sm:text-[44px]">{heading}</h1>
      <p className="mt-3 max-w-md text-[15px] text-steel">{body}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink to="/">Go home</ButtonLink>
        <ButtonLink to={what === 'campaign' ? '/campaigns' : '/creators'} variant="secondary">
          {what === 'campaign' ? 'Browse campaigns' : 'Discover creators'}
        </ButtonLink>
      </div>
    </div>
  );
}
