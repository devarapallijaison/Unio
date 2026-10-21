import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, SendHorizontal, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { initials } from '../../lib/format.js';
import { endpoints } from '../../services/api.js';
import { Card } from '../ui/Card.jsx';
import { Alert, Skeleton } from '../ui/Feedback.jsx';

/*
 * F6 messages: polls every 10 s while the page is visible, fetching only messages newer than the
 * last one seen. Sends optimistically. "about vN" tags attach a message to a version.
 */

const POLL_MS = 10_000;

const timeLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return today ? `Today ${time}` : `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${time}`;
};

function AboutTag({ about, dark }) {
  if (!about?.versionNumber) return null;
  return (
    <span className={`mr-1.5 inline-block rounded-[4px] px-1.5 align-[1px] font-mono text-[10.5px] font-bold ${dark ? 'bg-white/15 text-bone' : 'bg-wait-bg text-wait'}`}>
      about v{about.versionNumber}
    </span>
  );
}

function Bubble({ m }) {
  if (m.kind === 'system') {
    return (
      <div className="flex justify-center px-2">
        <span className="inline-flex max-w-full items-start gap-1.5 rounded-full border border-dashed border-line2 bg-white px-3 py-1 text-[12px] text-slate">
          <Upload className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="min-w-0">
            {m.body} · {timeLabel(m.createdAt).replace('Today ', '')}
          </span>
        </span>
      </div>
    );
  }
  if (m.mine) {
    return (
      <div className="flex flex-col items-end">
        <p className={`max-w-[85%] whitespace-pre-line rounded-[14px] rounded-br-[4px] bg-navy px-3.5 py-2.5 text-[14px] text-white ${m.pending ? 'opacity-60' : ''}`}>
          <AboutTag about={m.about} dark />
          {m.body}
        </p>
        <span className="mt-1 text-[12px] text-steel">You · {m.pending ? 'sending…' : timeLabel(m.createdAt)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <span aria-hidden className="grid size-[30px] shrink-0 place-items-center rounded-full bg-line text-[11px] font-bold text-navy">
        {initials(m.senderName ?? '')}
      </span>
      <div className="min-w-0">
        <p className="max-w-full whitespace-pre-line rounded-[14px] rounded-bl-[4px] border border-line bg-white px-3.5 py-2.5 text-[14px]">
          <AboutTag about={m.about} />
          {m.body}
        </p>
        <span className="mt-1 block text-[12px] text-steel">
          {m.senderName} · {timeLabel(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** versions: [{ deliverableId, number, label }] for the "about" selector; defaultAbout picks the current one. */
export function MessagesPanel({ projectId, versions = [], defaultAbout, readOnly = false }) {
  const qc = useQueryClient();
  const key = ['mine', 'project-messages', projectId];
  const [body, setBody] = useState('');
  const [about, setAbout] = useState(defaultAbout ?? '');
  const listRef = useRef(null);

  useEffect(() => setAbout(defaultAbout ?? ''), [defaultAbout]);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const prev = qc.getQueryData(key);
      const last = prev?.items.filter((m) => !m.pending).at(-1);
      const res = await endpoints.projects.messages(projectId, last ? { after: last.createdAt } : {});
      if (!prev) return { items: res.items };
      const seen = new Set(prev.items.map((m) => m._id));
      return { items: [...prev.items, ...res.items.filter((m) => !seen.has(m._id))] };
    },
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // Opening the thread (and new messages arriving while it's open) marks them read.
  const unreadFromOthers = items.filter((m) => !m.mine).length;
  useEffect(() => {
    if (!unreadFromOthers) return;
    endpoints.projects
      .markRead(projectId)
      .then(() => qc.invalidateQueries({ queryKey: ['me', 'unread'] }))
      .catch(() => {});
  }, [unreadFromOthers, projectId, qc]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const send = useMutation({
    mutationFn: (payload) => endpoints.projects.sendMessage(projectId, payload),
    onMutate: (payload) => {
      const temp = { _id: `tmp-${Date.now()}`, ...payload, mine: true, pending: true, kind: 'user', createdAt: new Date().toISOString() };
      qc.setQueryData(key, (d) => ({ items: [...(d?.items ?? []), temp] }));
      setBody('');
      return { temp, payload };
    },
    onSuccess: (msg, _p, ctx) => qc.setQueryData(key, (d) => ({ items: d.items.map((m) => (m._id === ctx.temp._id ? msg : m)) })),
    onError: (_e, _p, ctx) => {
      qc.setQueryData(key, (d) => ({ items: d.items.filter((m) => m._id !== ctx.temp._id) }));
      setBody(ctx.payload.body);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    const v = versions.find((x) => `${x.deliverableId}:${x.number}` === about);
    send.mutate({ body: text, ...(v ? { about: { deliverableId: v.deliverableId, versionNumber: v.number } } : {}) });
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-[17px] tracking-[-0.02em]">Messages</h2>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-steel">
          <Clock3 className="size-3.5" aria-hidden /> refreshes every 10 s
        </span>
      </div>
      <div ref={listRef} className="max-h-[560px] min-h-[220px] space-y-3.5 overflow-y-auto bg-soft/50 px-4 py-4" aria-live="polite">
        {query.isLoading ? (
          <Skeleton className="h-24" />
        ) : query.error ? (
          <Alert tone="error">Couldn’t load messages. They’ll retry automatically.</Alert>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-steel">No messages yet. Questions about the brief or a version go here.</p>
        ) : (
          items.map((m) => <Bubble key={m._id} m={m} />)
        )}
      </div>
      {!readOnly && (
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-line px-4 py-3">
          {versions.length > 0 && (
            <select
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              aria-label="Attach to a version"
              className="max-w-[92px] shrink-0 rounded-[4px] border-0 bg-wait-bg px-1.5 py-1 font-mono text-[11px] font-bold text-wait"
            >
              <option value="">no tag</option>
              {versions.map((v) => (
                <option key={`${v.deliverableId}:${v.number}`} value={`${v.deliverableId}:${v.number}`}>
                  about {v.label}
                </option>
              ))}
            </select>
          )}
          <label htmlFor={`msg-${projectId}`} className="sr-only">
            Write a message
          </label>
          <input
            id={`msg-${projectId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder="Write a message…"
            className="h-11 min-w-0 flex-1 rounded-md border border-line bg-white px-3.5 text-[14px] outline-none focus:border-navy"
          />
          <button type="submit" disabled={!body.trim()} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-white disabled:opacity-40">
            <SendHorizontal className="size-4" />
          </button>
        </form>
      )}
      {send.error && (
        <p className="border-t border-line px-4 py-2 text-[12.5px] text-att" role="alert">
          {send.error.message}
        </p>
      )}
    </Card>
  );
}
