// Chat workspace — attach any entity · real durable backend (AI SDK transport)
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Icons, LogoMark } from "./icons";
import { EntityIcon, RefChip } from "./ui";
import { ENTITIES, FIELDS, SUGGESTIONS, byId, related, subtitleOf, addUpload, listConversations, saveConversation, deleteConversation } from "@/lib/gtm/data";
import { enabledMcpServers, refreshOauthServers } from "@/lib/gtm/mcpServers";
import { agentFiles } from "@/lib/gtm/agents";
import { MessageResponse } from "@/components/ai-elements/message";
import { LoadingIndicator } from "./LoadingIndicator";

const textOf = (m) => (m.parts || []).filter((p) => p.type === "text").map((p) => p.text).join("");
const toolName = (type) => type.replace(/^tool-/, "").replace(/^mcp__[a-z0-9-]+__/, "").replace(/_/g, " ");

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

function AgentMessage({ msg, turnBusy, isLast, onToast, onRegenerate }) {
  const tools = (msg.parts || []).filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"));
  const text = textOf(msg);
  const writing = isLast && turnBusy;
  const settled = !isLast || !turnBusy;
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
        {!text && isLast && turnBusy && (
          <div style={{ marginTop: tools.length ? 8 : 0 }}><LoadingIndicator /></div>
        )}
        {settled && text && (
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <button className="icon-btn" title="Copy" onClick={() => { navigator.clipboard?.writeText(text); onToast("Copied to clipboard", "success"); }}><Icons.Copy size={15} /></button>
            <button className="icon-btn" title="Regenerate" onClick={onRegenerate}><Icons.Refresh size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// Cross-entity attach picker — searches the org's CRM via /api/search
// (search_entities), so it finds records beyond the locally-loaded page.
function AttachPicker({ attached, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const attachedIds = new Set(attached.map((r) => r.id));

  useEffect(() => {
    const id = setTimeout(async () => {
      const query = q.trim();
      if (!query) { setGroups([]); setLoading(false); return; }
      const my = ++reqId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json());
        if (my !== reqId.current) return;
        setGroups(res.groups || []);
      } catch { if (my === reqId.current) setGroups([]); }
      if (my === reqId.current) setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center", zIndex: 95 }} onClick={onClose}>
      <div className="attach-modal" onClick={(e) => e.stopPropagation()}>
        <div className="attach-search">
          <Icons.Search size={16} style={{ color: "var(--fg-muted)" }} />
          <input autoFocus placeholder="Search deals, accounts, meetings…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={onClose}><Icons.X size={16} /></button>
        </div>
        <div className="attach-list scroll">
          {!q.trim() ? <div className="attach-hint">Type to search your CRM.</div>
            : loading ? <div className="attach-hint">Searching…</div>
            : groups.length === 0 ? <div className="attach-hint">No records found for “{q.trim()}”.</div>
            : groups.map((g) => (
              <div key={g.type}>
                <div className="attach-group-label">{(ENTITIES[g.type] || {}).plural || g.type}</div>
                {g.items.filter((r) => !attachedIds.has(r.id)).map((r) => (
                  <div key={r.id} className="attach-item" onClick={() => onPick(r)}>
                    <EntityIcon type={r.type} size={30} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="nm">{r.name}</div>
                      <div className="sb">{r.subtitle}</div>
                    </div>
                    <Icons.Plus size={15} style={{ color: "var(--fg-muted)" }} />
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  const pending = file.status === "uploading" || file.datasourceId == null;
  return (
    <span className="file-chip" title={file.fileName}>
      {pending ? <Icons.Refresh size={13} className="spin" /> : <Icons.Paperclip size={13} />}
      <span className="file-chip-name">{file.fileName}</span>
      <button className="file-chip-x" onClick={() => onRemove(file)}><Icons.X size={12} /></button>
    </span>
  );
}

function Composer({ onSend, attached, onRemove, files, onUploadFile, onRemoveFile, uploading, onOpenPicker, busy }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  const fileRef = useRef(null);
  const grow = (el) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; };
  const send = () => { if (text.trim() && !busy) { onSend(text.trim()); setText(""); if (ref.current) ref.current.style.height = "auto"; } };
  // Create the file input on demand and click it within the user gesture — the
  // most reliable cross-browser way to open the OS file picker (no hidden input,
  // no label/SVG quirks, works in Safari).
  const openFilePicker = () => {
    if (uploading) return;
    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "position:fixed;left:-9999px;top:0;";
    input.addEventListener("change", () => { const f = input.files && input.files[0]; if (f) onUploadFile(f); try { document.body.removeChild(input); } catch {} });
    document.body.appendChild(input);
    input.click();
  };
  return (
    <div className="composer-wrap" style={{ position: "relative" }}>
      <div className={"composer" + (focus ? " focus" : "")}>
        {(attached.length > 0 || files.length > 0) && (
          <div className="chip-tray">
            {attached.map((r) => <RefChip key={r.id} record={r} removable onRemove={onRemove} />)}
            {files.map((f) => <FileChip key={f.datasourceId ?? f.fileName} file={f} onRemove={onRemoveFile} />)}
          </div>
        )}
        <textarea ref={ref} value={text} rows={1}
          placeholder={attached.length || files.length ? "Ask about the attached records and files or type to chat…" : "Ask anything — attach a record with @ or a file with the clip"}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChange={(e) => { setText(e.target.value); grow(e.target); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <div className="composer-row">
          <button type="button" className="icon-btn" title="Upload a file" disabled={uploading} onClick={openFilePicker}>
            {uploading ? <Icons.Refresh size={16} className="spin" /> : <Icons.Paperclip size={16} />}
          </button>
          <button className="icon-btn" title="Attach a record" onClick={onOpenPicker}><Icons.At size={16} /></button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)", marginRight: 6 }} className="hide-mobile">↵ send · ⇧↵ new line</span>
          <button className="btn btn-icon btn-primary" onClick={send} disabled={!text.trim() || busy} style={{ borderRadius: "50%" }}><Icons.ArrowUp size={16} /></button>
        </div>
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
          <div className="eyebrow" style={{ fontSize: 10 }}>{meta.label}</div>
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
              <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val == null || val === "" ? "—" : String(val)}</div>
            </div>
          );
        })}
      </div>
      {rec.type === "meeting" && rec.summary && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Summary</div>
          <div style={{ fontSize: 13, color: "var(--fg-body)", lineHeight: 1.5 }}>{rec.summary}</div>
        </div>
      )}
      {["account", "owner", "contact"].includes(rec.type) && (() => {
        const order = ["deal", "meeting", "task", "contact"];
        const chips = [].concat(...order.map((k) => rel[k] || [])).slice(0, 6);
        if (!chips.length) return null;
        return (
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Related</div>
            <div className="chip-wrap">{chips.map((r) => <RefChip key={r.id} record={r} onOpen={onOpenRecord} />)}</div>
          </div>
        );
      })()}
    </div>
  );
}

function ContextPanel({ attached, onOpenRecord, onAttach, onRemove, open, onClose, collapsed }) {
  return (
    <>
      <div className={"ctx-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"ctx-panel" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
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

function contextPreamble(records, files = []) {
  const blocks = [];
  if (records.length) {
    const lines = records.map((r) => `- ${ENTITIES[r.type].label}: ${r.name}${subtitleOf(r) ? ` (${subtitleOf(r)})` : ""}`).join("\n");
    blocks.push(`The user has attached these CRM records. Ground your answer in them and use tools to fetch more detail as needed:\n${lines}`);
  }
  const withId = files.filter((f) => f.datasourceId != null);
  if (withId.length) {
    const lines = withId.map((f) => `- ${f.fileName} (datasource_id: ${f.datasourceId})`).join("\n");
    blocks.push(`The user uploaded these files. Read their contents with the read_file tool (pass the datasource_id) before answering questions about them:\n${lines}`);
  }
  return blocks.join("\n\n");
}

function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return d === 1 ? "yesterday" : `${d}d ago`;
}

// Left slide-over listing past conversations; reopening rehydrates the full
// transcript from localStorage (see saveConversation in lib/gtm/data).
function HistoryDrawer({ open, onClose, onSelect, activeId }) {
  const [items, setItems] = useState([]);
  useEffect(() => { if (open) setItems(listConversations()); }, [open]);
  if (!open) return null;
  const remove = (e, id) => { e.stopPropagation(); deleteConversation(id); setItems(listConversations()); };
  return (
    <div className="sheet-backdrop" style={{ justifyContent: "flex-start", zIndex: 96 }} onClick={onClose}>
      <aside className="hist-drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <Icons.History size={17} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>Chat history</div>
          <button className="icon-btn" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div className="scroll" style={{ flex: 1, padding: 8 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 16px" }}>
              <Icons.Chat size={26} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13.5 }}>No past chats yet. Your conversations will appear here.</div>
            </div>
          ) : items.map((c) => (
            <div key={c.id} className={"hist-item" + (c.id === activeId ? " active" : "")} onClick={() => onSelect(c)}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="hist-title">{c.title}</div>
                {c.preview && <div className="hist-preview">{c.preview}</div>}
                <div className="hist-meta">{timeAgo(c.updatedAt)} · {c.messageCount} message{c.messageCount === 1 ? "" : "s"}</div>
              </div>
              <button className="icon-btn hist-del" title="Delete" onClick={(e) => remove(e, c.id)}><Icons.X size={15} /></button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function ChatScreen({ seedAttached, resume, agent, onBack, onOpenRecord, onToast, onOpenConversation, onNewChat }) {
  const conversationId = useMemo(() => resume?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`), []);
  const runIdRef = useRef(resume?.runId);
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const [histOpen, setHistOpen] = useState(false);
  const [attached, setAttached] = useState(() => (seedAttached || []).filter(Boolean));
  const [files, setFiles] = useState(() => (agent ? agentFiles(agent) : [])); // { datasourceId, fileName, status }
  const [uploading, setUploading] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxCollapsed, setCtxCollapsed] = useState(() => { try { return localStorage.getItem("ampup-ctx-collapsed") === "1"; } catch { return false; } });
  const [pickerOpen, setPickerOpen] = useState(false);
  const toggleCollapse = () => setCtxCollapsed((v) => { const n = !v; try { localStorage.setItem("ampup-ctx-collapsed", n ? "1" : "0"); } catch {} return n; });
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  const filesRef = useRef(files);
  filesRef.current = files;

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
          const pre = contextPreamble(attachedRef.current, filesRef.current);
          const msg = pre
            ? { ...last, parts: (last.parts || []).map((p) => (p.type === "text" ? { ...p, text: `${pre}\n\n${p.text}` } : p)) }
            : last;
          const ag = agentRef.current;
          const all = enabledMcpServers();
          // An agent scopes the chat to its server subset (by slug or id); a plain
          // chat exposes every enabled server. The built-in ampup CRM is added
          // server-side unless the agent opts out (includeAmpup=false).
          const servers = ag && Array.isArray(ag.mcpServerIds)
            ? all.filter((s) => ag.mcpServerIds.includes(s.slug) || ag.mcpServerIds.includes(s.id))
            : all;
          return {
            body: {
              conversationId,
              message: msg,
              runId: runIdRef.current,
              mcpServers: servers,
              systemPrompt: ag?.systemPrompt || undefined,
              includeAmpup: ag ? ag.includeAmpup !== false : true,
            },
          };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({ transport });
  // The durable run keeps its stream open across turns (preventClose), so the
  // transport `status` never settles back to "ready" — it stays "streaming"
  // forever, which would leave the composer disabled and block every follow-up.
  // Derive turn-completion from message stability instead: a turn is busy from
  // send until the assistant's deltas stop arriving.
  const [turnBusy, setTurnBusy] = useState(false);
  const busy = turnBusy;
  useEffect(() => {
    if (!turnBusy) return;
    if (status === "error") { setTurnBusy(false); return; } // failed turn: unblock the composer
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return; // still awaiting the first assistant token
    // A tool call has a silent gap (no chunks) while it runs, which looks like
    // the turn finished. Don't settle until every tool part on the last message
    // has resolved (same "done" signal TraceRow uses).
    const toolPending = (last.parts || []).some(
      (p) => typeof p.type === "string" && p.type.startsWith("tool-") &&
        p.state !== "output-available" && p.state !== "output-error",
    );
    if (toolPending) return;
    const t = setTimeout(() => setTurnBusy(false), 1100);
    return () => clearTimeout(t);
  }, [messages, turnBusy, status]);
  // Re-engage if the agent fires another tool after appearing to settle (a
  // multi-step turn that narrates between tool calls): an actively-running tool
  // on the last message always means the turn isn't done.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const toolRunning = (last.parts || []).some(
      (p) => typeof p.type === "string" && p.type.startsWith("tool-") &&
        p.state !== "output-available" && p.state !== "output-error",
    );
    if (toolRunning) setTurnBusy(true);
  }, [messages]);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  // Refresh any OAuth MCP tokens nearing expiry so this conversation starts with
  // a fresh token (long single sessions past expiry should be reopened).
  useEffect(() => { refreshOauthServers(); }, []);
  // Rehydrate a reopened conversation's transcript once on mount.
  useEffect(() => { if (resume?.messages?.length) setMessages(resume.messages); }, []);
  // Persist the transcript locally so it shows in History. The durable run keeps
  // its stream open across turns (preventClose), so `status` never settles to
  // "ready" — instead debounce on message stability: once deltas stop arriving,
  // save the final transcript.
  useEffect(() => {
    if (!messages.some((m) => m.role === "user")) return;
    const t = setTimeout(() => saveConversation({ id: conversationId, runId: runIdRef.current, messages }), 900);
    return () => clearTimeout(t);
  }, [messages, conversationId]);

  const addRec = (r) => setAttached((a) => (a.some((x) => x.id === r.id) ? a : [...a, r]));
  const removeRec = (r) => setAttached((a) => a.filter((x) => x.id !== r.id));
  const removeFile = (f) => setFiles((fs) => fs.filter((x) => x.datasourceId !== f.datasourceId));
  const clear = () => { runIdRef.current = undefined; setMessages([]); setTurnBusy(false); };
  const send = (t) => { setTurnBusy(true); sendMessage({ text: t }); };
  const doRegenerate = () => { setTurnBusy(true); regenerate(); };

  // Read a file as base64 and upload it; link to an attached deal/account.
  const uploadFile = async (file) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] || "");
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const deal = attachedRef.current.find((r) => r.type === "deal");
      const acct = attachedRef.current.find((r) => r.type === "account");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, file_content_base64: b64, opportunity_id: deal?.id, account_id: acct?.id }),
      }).then((r) => r.json());
      if (res.ok) {
        const entry = { datasourceId: res.datasourceId, fileName: res.fileName, status: res.status, ts: Date.now(), linkedName: deal?.name || acct?.name || "" };
        setFiles((fs) => [...fs.filter((x) => x.datasourceId !== entry.datasourceId), entry]);
        addUpload(entry);
        onToast(`Uploaded ${file.name} — the agent can read it now`, "success");
      } else {
        onToast(`Upload failed: ${res.error || "error"}`, "error");
      }
    } catch {
      onToast("Upload failed", "error");
    }
    setUploading(false);
  };

  // Build a redacted projection (user + final assistant text, no tool trace) and
  // persist it server-side; the returned id is a public, read-only share link.
  const shareChat = async () => {
    const projection = messages
      .map((m) => ({ role: m.role, text: textOf(m).trim() }))
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.text);
    if (projection.length === 0) { onToast("Nothing to share yet — send a message first", "info"); return; }
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: { title, messages: projection } }),
      }).then((r) => r.json());
      if (res.id) {
        const url = `${window.location.origin}/?share=${res.id}`;
        try { await navigator.clipboard?.writeText(url); } catch {}
        onToast("Public read-only link copied to clipboard", "success");
      } else {
        onToast(res.error ? `Share failed: ${res.error}` : "Could not create share link", "error");
      }
    } catch {
      onToast("Could not create share link", "error");
    }
  };

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
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent ? agent.name : `Chat with ${title}`}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{agent ? `${agent.tag || "Agent"} · ${attached.length ? `${attached.length} attached · ` : ""}grounded in your data` : `${attached.length ? `${attached.length} attached` : "No records attached"} · grounded in your CRM`}</div>
          </div>
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => setHistOpen(true)}><Icons.History size={14} /> History</button>
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => (onNewChat ? onNewChat() : clear())}><Icons.Chat size={14} /> New chat</button>
          <button className="btn btn-sm btn-outline ctx-toggle" onClick={() => setCtxOpen(true)}><Icons.Panel size={14} /> Context</button>
          <button className="btn btn-sm btn-outline ctx-collapse-btn" title={ctxCollapsed ? "Show context panel" : "Hide context panel"} onClick={toggleCollapse}><Icons.Panel size={14} /> {ctxCollapsed ? "Show panel" : "Hide panel"}</button>
          <button className="btn btn-sm btn-outline hide-mobile" onClick={shareChat}><Icons.Share size={14} /> Share</button>
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
                : <AgentMessage key={m.id} msg={m} turnBusy={busy} isLast={m.id === lastId} onToast={onToast} onRegenerate={doRegenerate} />,
            )}
            {busy && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="msg-row msg-agent">
                <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}><LogoMark size={17} /></div>
                <div className="bubble" style={{ flex: 1, minWidth: 0 }}><LoadingIndicator /></div>
              </div>
            )}
          </div>
        </div>

        <Composer onSend={send} attached={attached} onRemove={removeRec} files={files} onUploadFile={uploadFile} onRemoveFile={removeFile} uploading={uploading} onOpenPicker={() => setPickerOpen(true)} busy={busy} />
      </div>

      <ContextPanel attached={attached} onOpenRecord={onOpenRecord} onAttach={() => setPickerOpen(true)} onRemove={removeRec} open={ctxOpen} onClose={() => setCtxOpen(false)} collapsed={ctxCollapsed} />

      {pickerOpen && <AttachPicker attached={attached} onPick={(r) => { addRec(r); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}

      <HistoryDrawer open={histOpen} activeId={conversationId} onClose={() => setHistOpen(false)}
        onSelect={(c) => { setHistOpen(false); if (c.id !== conversationId && onOpenConversation) onOpenConversation(c); }} />
    </div>
  );
}
