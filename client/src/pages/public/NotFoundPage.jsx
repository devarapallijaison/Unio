import { ButtonLink } from '../../components/ui/Button.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

export default function NotFoundPage({ what }) {
  useDocumentTitle('Not found');
  const heading = what ? `This ${what} isn’t available` : 'This page doesn’t exist';
  const body = what
    ? `It may have been removed, or it isn’t public yet. Try browsing ${what === 'creator' ? 'other creators' : 'open campaigns'} instead.`
    : 'The link may be broken or the page may have moved.';
  return (
    <div className="container-page grid min-h-[60vh] items-center gap-10 py-20 md:grid-cols-12">
      <p className="font-display text-[clamp(6rem,18vw,14rem)] font-[300] italic leading-none text-sage md:col-span-5" aria-hidden>
        404
      </p>
      <div className="md:col-span-7">
        <h1 className="text-4xl sm:text-5xl">{heading}</h1>
        <p className="mt-4 max-w-md text-[17px] text-muted">{body}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink to="/creators">Explore creators</ButtonLink>
          <ButtonLink to="/campaigns" variant="secondary">
            Browse campaigns
          </ButtonLink>
          <ButtonLink to="/" variant="ghost">
            Home
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
