import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { Reasons } from '../../components/ui/Match.jsx';
import { MadeOnUnio, ToolChip } from '../../components/ui/Trust.jsx';

/* v9 P6 — "How it works · trust & rights". Explanatory content; nothing here is user data. */

const LEVELS = [
  ['Self-reported', 'The creator lists the tool. Shown as a light chip and counts half in matching.', 'self', 'border-t-line2'],
  ['Pending', 'Evidence sent. A reviewer is checking it.', 'pending', 'border-t-line2'],
  ['Certified', 'Course or vendor certificate with a working verify link.', 'certified', 'border-t-navy'],
  ['Verified', 'Live screen recording with a one-time challenge code, plus AI pre-check and a human reviewer.', 'verified', 'border-t-ok'],
  ['★ Made on UNIO', 'Automatic when a project is completed and approved here.', 'made', 'border-t-gold'],
];

const RIGHTS = [
  ['Usage', 'Ads, social, web, print'],
  ['Region', 'India or worldwide'],
  ['Duration', '3, 6, 12 months or forever'],
  ['Exclusive', 'Can the creator reuse it?'],
  ['Safe tools', 'Commercially licensed only'],
  ['AI label', 'Disclose AI on posts'],
  ['Likeness', 'Real faces or voices allowed?'],
  ['Hand-off', 'Rights card with final files'],
];

export default function HowItWorksPage() {
  useDocumentTitle('How it works');
  const { hash } = useLocation();
  // Footer links point at #trust, #rights and #demo-content.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <>
      <section className="bg-[linear-gradient(180deg,var(--color-ink),var(--color-navy))] pb-16 pt-14 md:pb-[72px] md:pt-20">
        <div className="container-page">
          <span className="eyebrow text-mist">How UNIO works</span>
          <h1 className="mt-3 text-[40px] text-white md:text-[60px]">
            Trust you can <em className="!text-mist">check.</em>
            <br />
            Rights you can <em className="!text-mist">read.</em>
          </h1>
        </div>
      </section>

      <div id="trust" className="container-page scroll-mt-20 pb-4 pt-[72px]">
        <div className="mb-7 flex flex-col gap-2.5">
          <span className="eyebrow">UNIO Trust</span>
          <h2 className="text-[30px] md:text-[40px]">Five levels. Each one needs more proof.</h2>
        </div>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LEVELS.map(([title, body, state, top], i) => (
            <li key={title} className={`flex flex-col items-start gap-3 rounded-lg border border-t-4 border-line bg-white p-[18px] ${top}`}>
              <span className="font-mono text-[12px] text-steel">0{i + 1}</span>
              {state === 'made' ? <MadeOnUnio /> : <ToolChip name={title} state={state} />}
              <p className="text-[12.5px] text-steel">{body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-[22px] grid gap-[18px] md:grid-cols-2">
          <section className="rounded-lg border border-line bg-white p-[22px]">
            <h3 className="text-[18px]">The challenge code</h3>
            <p className="mb-4 mt-1.5 text-[12.5px] text-steel">Why a screen recording can’t be faked with someone else’s video.</p>
            <div className="flex flex-col gap-2 rounded-md bg-ink p-[18px] text-bone">
              <span className="font-mono text-[28px] tracking-[0.1em] text-white">UNIO-7F3K</span>
              <span className="text-[12.5px]">Type this in your prompt, record the generation, upload the link. Code works once, for 48 hours.</span>
            </div>
          </section>
          <section className="rounded-lg border border-line bg-white p-[22px]">
            <h3 className="text-[18px]">Honest limits</h3>
            <p className="mb-3 mt-1.5 text-[12.5px] text-steel">Verification is evidence-based. It is not 100%.</p>
            <Reasons
              items={[
                'Badges expire after 12 months',
                'Duplicate-hash check on past work',
                'Reviewers are invite-only, never self-serve',
                'Brands can report a badge; reviewer re-checks',
              ]}
            />
          </section>
        </div>
      </div>

      <section id="rights" className="mt-[72px] scroll-mt-20 bg-ink py-[72px]">
        <div className="container-page">
          <div className="mb-7 flex flex-col gap-2.5">
            <span className="eyebrow text-mist">Licensing &amp; commerciality</span>
            <h2 className="text-[30px] text-white md:text-[40px]">Seven questions, answered in every brief.</h2>
          </div>
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {RIGHTS.map(([title, body]) => (
              <li key={title} className="flex flex-col gap-1 rounded-lg border border-slate bg-navy p-4">
                <b className="text-white">{title}</b>
                <span className="text-[13px] text-mist">{body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-[18px] text-[12.5px] text-mist">The Rights &amp; usage card is a clear summary of what was agreed. It is not a legal contract.</p>
          <p id="demo-content" className="mt-6 max-w-2xl scroll-mt-20 border-t border-slate pt-5 text-[12.5px] text-mist">
            <span className="font-mono uppercase tracking-[0.12em] text-bone">About demo content · </span>
            This is a hackathon build. Profiles and brands marked “Demo” are fictional and show how the marketplace works; their portfolio pieces
            are placeholders, not real client work.
          </p>
        </div>
      </section>
    </>
  );
}
