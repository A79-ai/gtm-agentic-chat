// Chat workspace — attach any entity · real durable backend (AI SDK transport)
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Icons, LogoMark } from "./icons";
import { EntityIcon, RefChip } from "./ui";
import {
  DATA, ENTITIES, FIELDS, SUGGESTIONS, byId, related, searchAll, subtitleOf, ENTITY_ORDER,
} from "@/lib/gtm/data";
import { MessageResponse } from "@/components/ai-elements/message";
import { LoadingIndicator } from "./LoadingIndicator";

const textOf = (m) => (m.parts || []).filter((p) => p.type === "text").map((p) => p.text).join("");
const toolName = (type) => type.replace(/^tool-/, "").replace(/^mcp__ampup__/, "").replace(/_/g, " ");

function TraceRow({ part }) {
  const done = part.state === "output-available" || part.state === "output-error";
  return (
    <div className={"trace-row" + (done ? " done" : "")}>
      {done
        ? <Icons.Check size={13} style={{ color: "var(--mint-base)", flexShrink: 0, marginTop: 2 }} />
        : <Icons.Refresh size={13} className="spin" style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />}
      <span>{done ? "" : "Running "}{toolName(part.type)}</span>
    </div>
  );
}

function AgentMessage({ msg, status, isLast, onToast, onRegenerate }) {
  const tools = (msg.parts || []).filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"));
  const text = textOf(msg);
  const writing = isLast && status === "streaming";
  const settled = !isLast || status === "ready";
  return (
    <div className="msg-row msg-agent">
      <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}><LogoMark size={17} /></div>
      <div className="bubble" style={{ flex: 1, minWidth: 0 }}>
        {tools.length > 0 && <div className="trace">{tools.map((p, i) => <TraceRow key={i} part={p} />)}</div>}
        {text && (
          <div style={{ fontSize: 14.5 }}>
            <MessageResponse>{text}</MessageResponse>
            {writing && <span className="caret" />}
          </div>
        )}
        {!text && isLast && status !== "ready" && (
          <div style={{ marginTop: tools.length ? 8 : 0 }}><LoadingIndicator /></div>
        )}
        {settled && text && (
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <button className="icon-btn" title="Copy" onClick={() => { navigator.clipboard?.writeText(text); onToast("Copied to clipboard", "success"); }}><Icons.Copy size={15} /></button>
            <button className="icon-btn" title="Regenerate" onClick={onRegenerate}><Icons.Refresh size={15} /></button>
            <button className="btn btn-sm btn-ghost" onClick={() => onToast("Saved to activity & CRM", "success")}><Icons.Save size={14} /> Save to CRM</button>
            <button className="btn btn-sm btn-ghost" onClick={() => onToast("Drafting an agent from this chat…", "success")}><Icons.Spark size={14} /> Turn into agent</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachPicker({ attachedIds, onPick, onClose }) {
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const h = (ev) => { if (ref.current && !ref.current.contains(ev.target)) onClose(); };
    const id = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", h); };
  }, []);
  const results = searchAll(q).filter((r) => !attachedIds.includes(r.id));
  const grouped = ENTITY_ORDER.map((t) => [t, results.filter((r) => r.type === t)]).filter(([, l]) => l.length);
  return (
    <div className="attach-pop" ref={ref}>
      <div className="attach-search">
        <Icons.Search size={16} style={{ color: "var(--fg-muted)" }} />
        <input autoFocus placeholder="Attach a deal, account, meeting, contact…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="attach-list scroll">
        {grouped.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>No records found</div>}
        {grouped.map(([t, list]) => (
          <div key={t}>
            <div className="attach-group-label">{ENTITIES[t].plural}</div>
            {list.map((r) => (
              <div key={r.id} className="attach-item" onClick={() => onPick(r)}>
                <EntityIcon type={r.type} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nm">{r.name}</div>
                  <div className="sb">{subtitleOf(r)}</div>
                </div>
                <Icons.Plus size={15} style={{ color: "var(--fg-muted)" }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Composer({ onSend, attached, onRemove, onPick, attachedIds, busy }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const [pick, setPick] = useState(false);
  const ref = useRef(null);
  const grow = (el) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; };
  const send = () => { if (text.trim() && !busy) { onSend(text.trim()); setText(""); if (ref.current) ref.current.style.height = "auto"; } };
  return (
    <div className="composer-wrap" style={{ position: "relative" }}>
      <div className={"composer" + (focus ? " focus" : "")}>
        {attached.length > 0 && (
          <div className="chip-tray">{attached.map((r) => <RefChip key={r.id} record={r} removable onRemove={onRemove} />)}</div>
        )}
        <textarea ref={ref} value={text} rows={1}
          placeholder={attached.length ? "Ask about the attached records or type to chat…" : "Ask anything — attach a deal, account or meeting with @"}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <div className="composer-row">
          <button className="icon-btn" title="Attach record" onClick={() => setPick((v) => !v)}><Icons.Paperclip size={16} /></button>
          <button className="icon-btn" title="Mention" onClick={() => setPick((v) => !v)}><Icons.At size={16} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", marginRight: 6 }} className="hide-mobile">↵ send · ⇧↵ new line</span>
          <button className="btn btn-icon btn-primary" onClick={send} disabled={!text.trim() || busy} style={{ borderRadius: "50%" }}><Icons.ArrowUp size={16} /></button>
        </div>
        {pick && <AttachPicker attachedIds={attachedIds} onPick={(r) => { onPick(r); setPick(false); }} onClose={() => setPick(false)} />}
      </div>
      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--fg-muted)", marginTop: 8 }}>
        Agents can make mistakes — verify data before sending to a customer.
      </div>
    </div>
  );
}

function ContextCard({ rec, onOpenRecord, onRemove }) {
  const meta = ENTITIES[rec.type];
  const fields = (FIELDS[rec.type] || []).slice(0, 4);
  const rel = related(rec);
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <EntityIcon type={rec.type} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rec.name}</div>
          <div className="overline" style={{ fontSize: 10 }}>{meta.label}</div>
        </div>
        <button className="icon-btn" title="Open" style={{ width: 28, height: 28 }} onClick={() => onOpenRecord(rec)}><Icons.ChevronRight size={16} /></button>
        <button className="icon-btn" title="Remove" style={{ width: 28, height: 28 }} onClick={() => onRemove(rec)}><Icons.X size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
        {fields.map((f) => {
          const [label, key, kind] = f;
          let val = rec[key];
          if (kind === "ref") { const r = byId(val); val = r ? r.name : "—"; }
          if (kind === "min") val = val ? `${val} min` : "—";
          return (
            <div key={label}>
              <div className="overline" style={{ fontSize: 9.5, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val == null || val === "" ? "—" : String(val)}</div>
            </div>
          );
        })}
      </div>
      {rec.type === "meeting" && rec.summary && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <div className="overline" style={{ fontSize: 10, marginBottom: 6 }}>Summary</div>
          <div style={{ fontSize: 13, color: "var(--fg-body)", lineHeight: 1.5 }}>{rec.summary}</div>
        </div>
      )}
      {["account", "owner", "contact"].includes(rec.type) && (() => {
        const order = ["deal", "meeting", "task", "contact"];
        const chips = [].concat(...order.map((k) => rel[k] || [])).slice(0, 6);
        if (!chips.length) return null;
        return (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div className="overline" style={{ fontSize: 10, marginBottom: 8 }}>Related</div>
            <div className="chip-wrap">{chips.map((r) => <RefChip key={r.id} record={r} onOpen={onOpenRecord} />)}</div>
          </div>
        );
      })()}
    </div>
  );
}

function ContextPanel({ attached, onOpenRecord, onAttach, onRemove, open, onClose }) {
  return (
    <>
      <div className={"ctx-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"ctx-panel" + (open ? " open" : "")}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icons.Layers size={17} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>Context</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{attached.length} record{attached.length === 1 ? "" : "s"} attached</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onAttach}><Icons.Plus size={14} /> Add</button>
          <button className="icon-btn ctx-close" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div className="scroll ctx-scroll" style={{ flex: 1 }}>
          {attached.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 16px" }}>
              <Icons.Inbox size={26} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13.5 }}>Attach a deal, account, meeting or contact to ground the chat.</div>
            </div>
          )}
          {attached.map((r) => <ContextCard key={r.id} rec={r} onOpenRecord={onOpenRecord} onRemove={onRemove} />)}
        </div>
      </aside>
    </>
  );
}

function contextPreamble(records) {
  if (!records.length) return "";
  const lines = records.map((r) => `- ${ENTITIES[r.type].label}: ${r.name}${subtitleOf(r) ? ` (${subtitleOf(r)})` : ""}`).join("\n");
  return `The user has attached these CRM records. Ground your answer in them and use tools to fetch more detail as needed:\n${lines}`;
}

export function ChatScreen({ seedAttached, onBack, onOpenRecord, onToast }) {
  const conversationId = useMemo(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`), []);
  const runIdRef = useRef(undefined);
  const [attachedIds, setAttachedIds] = useState(() => (seedAttached || []).map((r) => r.id));
  const [ctxOpen, setCtxOpen] = useState(false);
  const attached = attachedIds.map(byId).filter(Boolean);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, options) => {
          const res = await fetch(url, options);
          const id = res.headers.get("x-workflow-run-id");
          if (id) runIdRef.current = id;
          return res;
        },
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const pre = contextPreamble(attachedRef.current);
          const msg = pre
            ? { ...last, parts: (last.parts || []).map((p) => (p.type === "text" ? { ...p, text: `${pre}\n\n${p.text}` } : p)) }
            : last;
          return { body: { conversationId, message: msg, runId: runIdRef.current } };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const addRec = (r) => setAttachedIds((ids) => (ids.includes(r.id) ? ids : [...ids, r.id]));
  const removeRec = (r) => setAttachedIds((ids) => ids.filter((x) => x !== r.id));
  const clear = () => { runIdRef.current = undefined; setMessages([]); };
  const send = (t) => sendMessage({ text: t });

  const subjectType = attached[0] ? attached[0].type : "none";
  const suggestions = SUGGESTIONS[subjectType] || SUGGESTIONS.none;
  const title = attached.length === 1 ? attached[0].name : attached.length > 1 ? `${attached.length} records` : "your pipeline";
  const empty = messages.length === 0;
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  return (
    <div className="chat-wrap">
      <div className="chat-col">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px var(--pad)", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", minHeight: 60 }}>
          <button className="icon-btn" onClick={onBack} title="Back"><Icons.ArrowLeft size={18} /></button>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-muted)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-primary)", flexShrink: 0 }}><LogoMark size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Chat with {title}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{attached.length ? `${attached.length} attached` : "No records attached"} · grounded in your CRM</div>
          </div>
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => onToast("Chat history", "info")}><Icons.History size={14} /> History</button>
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={clear}><Icons.Chat size={14} /> New chat</button>
          <button className="btn btn-sm btn-outline ctx-toggle" onClick={() => setCtxOpen(true)}><Icons.Panel size={14} /> Context</button>
          <button className="btn btn-sm btn-outline hide-mobile" onClick={() => onToast("Share this chat", "info")}><Icons.Share size={14} /> Share</button>
        </div>

        <div ref={scrollRef} className="scroll chat-scroll">
          <div className="chat-inner">
            {empty ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "46vh", textAlign: "center", gap: 8 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--accent-soft)", color: "var(--fg-primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}><LogoMark size={28} /></div>
                <h3 style={{ fontFamily: "var(--font-hero)", fontSize: 26, color: "var(--fg-primary)" }}>Chat with {title}</h3>
                <p style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 440, marginBottom: 6 }}>
                  {attached.length ? "Ask anything about the attached records. I reason across your connected CRM, calls and notes." : "Attach a record below, or ask about your pipeline. I reason across your connected sources."}
                </p>
                {attached.length > 0 && <div className="chip-wrap" style={{ justifyContent: "center", marginBottom: 14 }}>{attached.map((r) => <RefChip key={r.id} record={r} onOpen={onOpenRecord} />)}</div>}
                <div className="suggest">{suggestions.map((sug, i) => <button key={i} onClick={() => send(sug)}>{sug}</button>)}</div>
              </div>
            ) : messages.map((m) =>
              m.role === "user"
                ? <div key={m.id} className="msg-row msg-user"><div className="bubble">{textOf(m)}</div></div>
                : <AgentMessage key={m.id} msg={m} status={status} isLast={m.id === lastId} onToast={onToast} onRegenerate={() => regenerate()} />,
            )}
            {busy && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="msg-row msg-agent">
                <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}><LogoMark size={17} /></div>
                <div className="bubble" style={{ flex: 1, minWidth: 0 }}><LoadingIndicator /></div>
              </div>
            )}
          </div>
        </div>

        <Composer onSend={send} attached={attached} attachedIds={attachedIds} onRemove={removeRec} onPick={addRec} busy={busy} />
      </div>

      <ContextPanel attached={attached} onOpenRecord={onOpenRecord} onAttach={() => setCtxOpen(true)} onRemove={removeRec} open={ctxOpen} onClose={() => setCtxOpen(false)} />
    </div>
  );
}
