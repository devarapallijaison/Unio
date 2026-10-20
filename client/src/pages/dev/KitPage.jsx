import { ArrowRight, Inbox, Plus, Sparkles, Upload } from 'lucide-react';
import { useState } from 'react';
import { StatTile, StatusTabs } from '../../components/dashboard/Kit.jsx';
import { PageHeader, Panel } from '../../components/layout/Layouts.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { AiMark, DemoBadge, Pill, StatusPill, Tag } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Banner, Card, SectionHead } from '../../components/ui/Card.jsx';
import { Alert, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { CheckRow, Checkbox, ChipSelect, Input, Segmented, Select, TagInput, Textarea } from '../../components/ui/Form.jsx';
import { Logo, LogoMark } from '../../components/ui/Logo.jsx';
import { MatchRing, Reasons, ScoreBars } from '../../components/ui/Match.jsx';
import { MediaFrame } from '../../components/ui/MediaFrame.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { RightsStrip, RightsTicket } from '../../components/ui/Rights.jsx';
import { MadeOnUnio, ToolChain, ToolChip, TrustLadder, TrustLevelTag } from '../../components/ui/Trust.jsx';
import { Filmstrip, VersionTimeline } from '../../components/ui/Versions.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/*
 * DEVELOPMENT ONLY — registered in router.jsx behind import.meta.env.DEV and not linked anywhere.
 * Every value below is SAMPLE data for comparing the kit with design/screens. Never copy these into live pages.
 */

const STATUSES = [
  'draft', 'open', 'closed', 'pending', 'accepted', 'rejected', 'withdrawn', 'declined', 'cancelled',
  'not_started', 'in_progress', 'submitted', 'revision_requested', 'completed', 'approved',
  'available', 'busy', 'unavailable', 'SELF_REPORTED', 'PENDING', 'VERIFIED', 'REJECTED',
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-1 text-[22px]">{title}</h2>
      <p className="eyebrow mb-4">{id}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({ children, dark = false }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg p-4 ${dark ? 'bg-navy' : 'border border-line bg-white'}`}>{children}</div>
  );
}

export default function KitPage() {
  useDocumentTitle('Kit (dev)');
  const [seg, setSeg] = useState('live');
  const [tab, setTab] = useState('');
  const [chips, setChips] = useState(['short']);
  const [checks, setChecks] = useState({ kling: true });
  const [tags, setTags] = useState(['Kling', 'Runway']);
  const [page, setPage] = useState(2);

  const toggle = (id) => setChips((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="min-h-dvh bg-page">
      <div className="sticky top-0 z-20 border-b border-wait-ln bg-wait-bg px-4 py-2 text-center font-mono text-[11px] tracking-[0.12em] text-wait">
        DEV ONLY · /dev/kit · SAMPLE DATA — compare with design/screens
      </div>
      <div className="container-page flex flex-col gap-12 py-10">
        <PageHeader eyebrow="Design system" title={<>Steel kit, <em>sample props.</em></>} description="Every component from guide §3.4 in one place." />

        <Section id="logo" title="Logo">
          <Row>
            <Logo className="h-8" />
            <LogoMark className="h-8" />
          </Row>
          <Row dark>
            <Logo onDark className="h-8" />
          </Row>
        </Section>

        <Section id="type" title="Type">
          <Row>
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Eyebrow · mono 10.5 caps</p>
              <h1 className="text-[44px]">AI creators, <em>proven.</em></h1>
              <h2 className="text-[34px]">Work you can trace back.</h2>
              <h3 className="text-[17px]">Card title 17px</h3>
              <p>Body 14px Manrope. <span className="text-steel">Muted text in steel.</span></p>
              <p className="text-[12.5px] text-steel">Small 12.5px</p>
              <p className="font-mono text-[12px]">UNIO-7F3K · v3</p>
            </div>
          </Row>
        </Section>

        <Section id="Button" title="Buttons">
          {['sm', 'md', 'lg'].map((size) => (
            <Row key={size}>
              <Button size={size}>Primary</Button>
              <Button size={size} variant="secondary">Secondary</Button>
              <Button size={size} variant="subtle">Subtle</Button>
              <Button size={size} variant="ghost">Ghost</Button>
              <Button size={size} variant="success">Approve v3</Button>
              <Button size={size} variant="danger">Send changes</Button>
              <Button size={size} loading>Saving</Button>
              <Button size={size} disabled>Disabled</Button>
            </Row>
          ))}
          <Row dark>
            <Button variant="light">
              Review v2 <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline-light">Join as a creator</Button>
            <Button variant="light" size="sm">
              <Upload className="size-4" /> Upload v3
            </Button>
          </Row>
        </Section>

        <Section id="Pill" title="Pills, tags, marks">
          <Row>
            {['ok', 'wait', 'att', 'info', 'neutral', 'dark', 'ai'].map((t) => (
              <Pill key={t} tone={t}>{t}</Pill>
            ))}
          </Row>
          <Row>
            {STATUSES.map((s) => (
              <StatusPill key={s} status={s} />
            ))}
          </Row>
          <Row>
            <Tag>4 recipe reels</Tag>
            <Tag>28 Oct</Tag>
            <DemoBadge />
            <AiMark />
            <AiMark label="AI BRIEF" />
          </Row>
        </Section>

        <Section id="Card" title="Card, SectionHead, Banner, Panel">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <SectionHead title="Projects" action={<a className="text-[13px] font-semibold">All projects →</a>} />
              <p className="p-5 text-steel">Card body.</p>
            </Card>
            <Card dark pad>
              <p className="eyebrow text-mist">Unio trust</p>
              <p className="mt-2 text-lg font-bold text-white">Dark card</p>
            </Card>
          </div>
          <Banner eyebrow="Good morning, Rahul" title="1 version needs your review today." action={<Button variant="light">Review v2 <ArrowRight className="size-4" /></Button>}>
            Ishita sent v2 of “Recipe reel 2”. Approve it or request changes with a note.
          </Banner>
          <Panel title="Panel" action={<Button size="sm" variant="ghost">Manage</Button>}>
            Panel body uses Card + SectionHead.
          </Panel>
        </Section>

        <Section id="StatTile" title="Stat tiles">
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile variant="navy" label="Live campaigns" value="3" hint="1 closes in 5 days" />
            <StatTile variant="bone" label="Applicants" value="14" hint="8 new" />
            <StatTile variant="highlight" label="Needs you" value="2" hint="1 version · 1 message" />
            <StatTile variant="grey" label="Spent · Oct" value="₹74K" hint="of ₹1.2L budget" />
            <StatTile variant="white" label="Profile views" value="312" hint="this week" />
          </div>
        </Section>

        <Section id="ToolChip" title="Trust: ToolChip, MadeOnUnio, ToolChain, TrustLadder, TrustLevelTag">
          <Row>
            <ToolChip name="Kling" state="verified" />
            <ToolChip name="ElevenLabs" state="certified" />
            <ToolChip name="ComfyUI" state="pending" />
            <ToolChip name="CapCut" state="self" />
            <MadeOnUnio count={6} />
            <MadeOnUnio />
          </Row>
          <Row>
            <ToolChain steps={['Midjourney', { name: 'Kling', verified: true }, { name: 'Runway', verified: true }, 'CapCut']} />
          </Row>
          <div className="grid gap-4 md:grid-cols-2">
            <Card pad className="flex flex-col gap-4">
              {[1, 2, 3, 4, 5].map((l) => (
                <TrustLadder key={l} level={l} showLabels={l === 5} />
              ))}
            </Card>
            <Card dark pad className="flex flex-col gap-4">
              {[2, 4, 5].map((l) => (
                <TrustLadder key={l} level={l} dark showLabels={l === 5} />
              ))}
            </Card>
          </div>
          <Row>
            {[1, 2, 3, 4, 5].map((l) => (
              <TrustLevelTag key={l} level={l} />
            ))}
          </Row>
        </Section>

        <Section id="MatchRing" title="Match: MatchRing, ScoreBars, Reasons">
          <Row>
            <MatchRing score={94} size="sm" />
            <MatchRing score={82} />
            <MatchRing score={61} size="lg" />
            <span className="rounded-lg bg-navy p-3">
              <MatchRing score={91} size="lg" dark />
            </span>
          </Row>
          <div className="grid gap-4 md:grid-cols-2">
            <Card pad>
              <ScoreBars
                rows={[
                  { label: 'Content type', points: 20, max: 20 },
                  { label: 'Skills', points: 16, max: 20 },
                  { label: 'Tools', points: 11, max: 15, half: true },
                  { label: 'Industry', points: 10, max: 10 },
                  { label: 'Availability', points: 2, max: 5 },
                ]}
              />
            </Card>
            <Card pad>
              <Reasons items={['Kling and Runway verified', '12 food pieces', 'Rate fits ₹6K–₹14K', 'Hindi voice-over']} />
            </Card>
          </div>
        </Section>

        <Section id="Rights" title="Rights: RightsStrip, RightsTicket">
          <RightsStrip summary="Paid ads · India · 6 months · Non-exclusive" />
          <div className="grid gap-6 md:grid-cols-2">
            <RightsTicket
              title="What the brand can do with your work"
              rows={[
                { label: 'Usage', value: 'Paid ads, organic social' },
                { label: 'Region', value: 'India' },
                { label: 'Duration', value: '6 months' },
                { label: 'Exclusivity', value: 'Non-exclusive' },
                { label: 'AI label', value: 'Required on posts' },
              ]}
            />
            <RightsTicket
              stamp="LICENSED"
              title="Verdant Skin Co. ← Meera Kulkarni"
              number="UN-2026-1043"
              rows={[
                { label: 'Valid', value: '24 Oct 2026 → 24 Apr 2027' },
                { label: 'Tools', value: 'Midjourney, Kling, Runway, CapCut' },
                { label: 'Likeness', value: 'AI-generated people only' },
              ]}
            />
          </div>
        </Section>

        <Section id="Versions" title="Versions: VersionTimeline, Filmstrip">
          <div className="grid gap-4 md:grid-cols-2">
            <Card pad>
              <VersionTimeline
                current={3}
                versions={[
                  { number: 1, note: 'Hook too slow — show product in first 2 s', meta: 'Changes requested · 14 Oct' },
                  { number: 2, note: 'Love the light. Text too small on a phone.', meta: 'Changes requested · Mon' },
                  { number: 3, note: 'Bigger captions, SPF badge on end card', meta: 'Waiting for you' },
                ]}
              />
            </Card>
            <Card pad>
              <Filmstrip current={3} versions={[1, 2, 3].map((n) => ({ number: n, note: n === 3 ? 'Current' : 'Changes' }))} />
            </Card>
          </div>
        </Section>

        <Section id="Form" title="Forms">
          <div className="grid gap-4 md:grid-cols-2">
            <Card pad className="flex flex-col gap-4">
              <Input label="Campaign title" placeholder="Diwali reel" />
              <Input label="Budget" ai defaultValue="₹12,000 – ₹18,000" labelExtra={<AiMark />} />
              <Select label="Industry" defaultValue="food">
                <option value="food">Food & beverage</option>
                <option value="beauty">Beauty & skincare</option>
              </Select>
              <Textarea label="Request changes" rows={3} hint="Required · at least 10 characters" placeholder="e.g. Swap the end-card colour to our green" />
              <Input label="With error" error="Enter a valid email address" defaultValue="meera@" />
            </Card>
            <Card pad className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {[['short', 'Short-form'], ['ad', 'Video ad'], ['ugcv', 'UGC']].map(([id, label]) => (
                  <ChipSelect key={id} selected={chips.includes(id)} onClick={() => toggle(id)}>
                    {label}
                  </ChipSelect>
                ))}
              </div>
              <Segmented
                label="Campaign state"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: 'live', label: 'Live · 3' },
                  { value: 'draft', label: 'Drafts · 1' },
                  { value: 'closed', label: 'Closed · 6' },
                ]}
              />
              <StatusTabs statuses={['pending', 'accepted', 'rejected']} value={tab} onChange={setTab} />
              <div>
                {[['kling', 'Kling', 3], ['runway', 'Runway', 2], ['veo', 'Veo', 0]].map(([id, label, n]) => (
                  <CheckRow key={id} label={label} count={n} checked={!!checks[id]} onChange={() => setChecks((c) => ({ ...c, [id]: !c[id] }))} />
                ))}
              </div>
              <Checkbox label="I’ve read the rights & usage terms" description="Required before applying." />
              <TagInput label="Tools" value={tags} onChange={setTags} suggestions={['Midjourney', 'CapCut', 'Veo']} />
            </Card>
          </div>
        </Section>

        <Section id="Feedback" title="Feedback & states">
          <div className="grid gap-3 md:grid-cols-2">
            <Alert tone="success">Verified tools count full in matching.</Alert>
            <Alert tone="warning">Runway badge expires in 41 days. Re-verify to keep it.</Alert>
            <Alert tone="error" title="Couldn’t save">Note must be at least 10 characters.</Alert>
            <Alert tone="ai">AI filled 9 of 11 fields — check them before publishing.</Alert>
            <Alert tone="info">Sign in to continue where you left off.</Alert>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState icon={Inbox} title="No applications yet" action={<Button size="sm"><Plus className="size-4" /> Post a brief</Button>}>
              When creators apply, they show up here with a match score.
            </EmptyState>
            <ErrorState error={{ message: 'Could not reach the server.' }} onRetry={() => {}} />
          </div>
          <Row>
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-64" />
          </Row>
        </Section>

        <Section id="Avatar" title="Avatar, MediaFrame, Pagination">
          <Row>
            {['sm', 'md', 'lg', 'xl'].map((s, i) => (
              <Avatar key={s} size={s} name={['Ishita Bansal', 'Meera Kulkarni', 'Vihaan Shah', 'Ananya Rao'][i]} />
            ))}
          </Row>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {['a', 'b', 'c', 'd', 'e', 'f'].map((s, i) => (
              <MediaFrame key={s} item={{ _id: `kit-${s}`, title: `Piece ${s}`, mediaType: i % 2 ? 'video' : 'image' }} />
            ))}
          </div>
          <Pagination page={page} totalPages={4} onChange={setPage} />
        </Section>

        <p className="text-center text-[12px] text-steel">
          <Sparkles className="mr-1 inline size-3" /> End of kit
        </p>
      </div>
    </div>
  );
}
