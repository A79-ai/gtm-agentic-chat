// Chat workspace: attach any entity · real durable backend (AI SDK transport)

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import MCP_CATALOG from "@/config/mcp-catalog.json";
import { agentFiles } from "@/lib/gtm/agents";
import { apiFetch, getMcpKey } from "@/lib/gtm/auth";
import { deleteConversation, listConversations, saveConversation } from "@/lib/gtm/conversations";
import {
  addUpload,
  byId,
  ENTITIES,
  FIELDS,
  related,
  SUGGESTIONS,
  subtitleOf,
} from "@/lib/gtm/data";
import { getLlmKey } from "@/lib/gtm/llmKey";
import { enabledMcpServers, refreshOauthServers } from "@/lib/gtm/mcpServers";
import { Icons, LogoMark } from "./icons";
import { LoadingIndicator } from "./LoadingIndicator";
import { EntityIcon, RefChip } from "./ui";

// Agents can scope to MCP servers two ways: by explicit catalog slug
// (mcpServerIds) or by category (mcpCategories, e.g. "Call recording", "CRM"),
// which matches WHATEVER provider in that category the user has connected, so
// the agent isn't pinned to a specific vendor. The built-in AmpUp CRM (via
// includeAmpup) already covers the "CRM" category for the missing-tools prompt.
const AMPUP_COVERS = new Set(["CRM"]);
const CATEGORY_LABELS = { "Call recording": "a call recorder", CRM: "a CRM" };

const catalogSlugsForCategories = (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [];
  }
  const wanted = new Set(categories);
  return MCP_CATALOG.filter((c) => wanted.has(c.category)).map((c) => c.slug);
};

// An agent constrains the chat's server set only if it lists explicit servers
// OR categories. An empty list is NOT a constraint: a user-built agent that
// ticked no servers should behave like a plain chat (use everything connected),
// not silently scope to zero servers.
const agentIsScoped = (agent) =>
  !!agent &&
  ((Array.isArray(agent.mcpServerIds) && agent.mcpServerIds.length > 0) ||
    (Array.isArray(agent.mcpCategories) && agent.mcpCategories.length > 0));

// Connected servers this agent should use: its explicit slugs plus any connected
// server whose catalog category the agent asked for.
const scopeServersForAgent = (agent, connected) => {
  const ids = new Set(Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : []);
  const catSlugs = new Set(catalogSlugsForCategories(agent.mcpCategories));
  return connected.filter(
    (s) => ids.has(s.slug) || ids.has(s.id) || catSlugs.has(s.slug) || catSlugs.has(s.id)
  );
};

// Text-ish files (under the size cap) are read in the browser and inlined
// straight into the prompt, usable instantly, no upload round-trip. Binary /
// rich formats (or anything larger) fall back to the AmpUp DataSource +
// read_file path. The cap bounds per-turn token cost, since inlined content
// rides the context while the file stays attached.
const INLINE_MAX_BYTES = 32 * 1024;
const TEXT_FILE_RE =
  /\.(md|markdown|txt|text|csv|tsv|json|jsonl|ya?ml|xml|html?|log|ini|toml|srt|vtt|tex|rst|[cm]?[jt]sx?|py|rb|go|rs|java|kt|c|h|cpp|cc|hpp|cs|php|swift|sh|bash|zsh|sql|css|scss|less|env|conf)$/i;
const isInlineable = (file) =>
  file.size <= INLINE_MAX_BYTES &&
  ((file.type || "").startsWith("text/") || TEXT_FILE_RE.test(file.name || ""));

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

const textOf = (m) =>
  (m.parts || [])
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
const toolName = (type) =>
  type
    .replace(/^tool-/, "")
    .replace(/^mcp__[a-z0-9-]+__/, "")
    .replace(/_/g, " ");
// Cheap transcript signature (message count + last message text length) so the
// save effect can skip when nothing changed (e.g. a pure reopen, or no-op
// re-renders) and only persist once per settled turn.
const convoSig = (msgs) => `${msgs.length}:${textOf(msgs[msgs.length - 1] || {}).length}`;

function TraceRow({ part }) {
  const done = part.state === "output-available" || part.state === "output-error";
  return (
    <div className={"trace-row" + (done ? " done" : "")}>
      {done ? (
        <Icons.Check size={13} style={{ color: "var(--mint-base)", flexShrink: 0, marginTop: 2 }} />
      ) : (
        <Icons.Refresh
          className="spin"
          size={13}
          style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}
        />
      )}
      <span>
        {done ? "" : "Running "}
        {toolName(part.type)}
      </span>
    </div>
  );
}

function AgentMessage({ msg, turnBusy, isLast, onToast, onRegenerate }) {
  const tools = (msg.parts || []).filter(
    (p) => typeof p.type === "string" && p.type.startsWith("tool-")
  );
  const text = textOf(msg);
  const writing = isLast && turnBusy;
  const settled = !(isLast && turnBusy);
  return (
    <div className="msg-row msg-agent">
      <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}>
        <LogoMark size={17} />
      </div>
      <div className="bubble" style={{ flex: 1, minWidth: 0 }}>
        {tools.length > 0 && (
          <div className="trace">
            {tools.map((p, i) => (
              <TraceRow key={i} part={p} />
            ))}
          </div>
        )}
        {text && (
          <div style={{ fontSize: 14.5 }}>
            <MessageResponse>{text}</MessageResponse>
            {writing && <span className="caret" />}
          </div>
        )}
        {!text && isLast && turnBusy && (
          <div style={{ marginTop: tools.length ? 8 : 0 }}>
            <LoadingIndicator />
          </div>
        )}
        {settled && text && (
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <button
              className="icon-btn"
              onClick={() => {
                navigator.clipboard?.writeText(text);
                onToast("Copied to clipboard", "success");
              }}
              title="Copy"
            >
              <Icons.Copy size={15} />
            </button>
            <button className="icon-btn" onClick={onRegenerate} title="Regenerate">
              <Icons.Refresh size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Cross-entity attach picker: searches the org's CRM via /api/search
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
      if (!query) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const my = ++reqId.current;
      setLoading(true);
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) =>
          r.json()
        );
        if (my !== reqId.current) {
          return;
        }
        setGroups(res.groups || []);
      } catch {
        if (my === reqId.current) {
          setGroups([]);
        }
      }
      if (my === reqId.current) {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      style={{ alignItems: "center", justifyContent: "center", zIndex: 95 }}
    >
      <div className="attach-modal" onClick={(e) => e.stopPropagation()}>
        <div className="attach-search">
          <Icons.Search size={16} style={{ color: "var(--fg-muted)" }} />
          <input
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search deals, accounts, meetings…"
            value={q}
          />
          <button className="icon-btn" onClick={onClose} style={{ width: 28, height: 28 }}>
            <Icons.X size={16} />
          </button>
        </div>
        <div className="attach-list scroll">
          {q.trim() ? (
            loading ? (
              <div className="attach-hint">Searching…</div>
            ) : groups.length === 0 ? (
              <div className="attach-hint">No records found for “{q.trim()}”.</div>
            ) : (
              groups.map((g) => (
                <div key={g.type}>
                  <div className="attach-group-label">
                    {(ENTITIES[g.type] || {}).plural || g.type}
                  </div>
                  {g.items
                    .filter((r) => !attachedIds.has(r.id))
                    .map((r) => (
                      <div className="attach-item" key={r.id} onClick={() => onPick(r)}>
                        <EntityIcon size={30} type={r.type} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="nm">{r.name}</div>
                          <div className="sb">{r.subtitle}</div>
                        </div>
                        <Icons.Plus size={15} style={{ color: "var(--fg-muted)" }} />
                      </div>
                    ))}
                </div>
              ))
            )
          ) : (
            <div className="attach-hint">Type to search your CRM.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  // Inlined files are usable the moment their text is read (no datasourceId
  // needed); only the binary upload path shows a pending spinner.
  const ready = !!file.text || file.datasourceId != null;
  const pending = file.status === "uploading" || !ready;
  return (
    <span className="file-chip" title={file.fileName}>
      {pending ? <Icons.Refresh className="spin" size={13} /> : <Icons.Paperclip size={13} />}
      <span className="file-chip-name">{file.fileName}</span>
      <button className="file-chip-x" onClick={() => onRemove(file)}>
        <Icons.X size={12} />
      </button>
    </span>
  );
}

function Composer({
  onSend,
  attached,
  onRemove,
  files,
  onUploadFile,
  onRemoveFile,
  uploading,
  onOpenPicker,
  busy,
}) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  const _fileRef = useRef(null);
  const grow = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  };
  const send = () => {
    if (text.trim() && !busy) {
      onSend(text.trim());
      setText("");
      if (ref.current) {
        ref.current.style.height = "auto";
      }
    }
  };
  // Create the file input on demand and click it within the user gesture. The
  // most reliable cross-browser way to open the OS file picker (no hidden input,
  // no label/SVG quirks, works in Safari).
  const openFilePicker = () => {
    if (uploading) {
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.style.cssText = "position:fixed;left:-9999px;top:0;";
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (f) {
        onUploadFile(f);
      }
      try {
        document.body.removeChild(input);
      } catch {}
    });
    document.body.appendChild(input);
    input.click();
  };
  return (
    <div className="composer-wrap" style={{ position: "relative" }}>
      <div className={"composer" + (focus ? " focus" : "")}>
        {(attached.length > 0 || files.length > 0) && (
          <div className="chip-tray">
            {attached.map((r) => (
              <RefChip key={r.id} onRemove={onRemove} record={r} removable />
            ))}
            {files.map((f) => (
              <FileChip
                file={f}
                key={f.id ?? f.datasourceId ?? f.fileName}
                onRemove={onRemoveFile}
              />
            ))}
          </div>
        )}
        <textarea
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            setText(e.target.value);
            grow(e.target);
          }}
          onFocus={() => setFocus(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            attached.length || files.length
              ? "Ask about the attached records and files or type to chat…"
              : "Ask anything. Attach a record with @ or a file with the clip"
          }
          ref={ref}
          rows={1}
          value={text}
        />
        <div className="composer-row">
          <button
            className="icon-btn"
            disabled={uploading}
            onClick={openFilePicker}
            title="Upload a file"
            type="button"
          >
            {uploading ? (
              <Icons.Refresh className="spin" size={16} />
            ) : (
              <Icons.Paperclip size={16} />
            )}
          </button>
          <button className="icon-btn" onClick={onOpenPicker} title="Attach a record">
            <Icons.At size={16} />
          </button>
          <div style={{ flex: 1 }} />
          <span
            className="hide-mobile"
            style={{ fontSize: 11.5, color: "var(--fg-muted)", marginRight: 6 }}
          >
            ↵ send · ⇧↵ new line
          </span>
          <button
            className="btn btn-icon btn-primary"
            disabled={!text.trim() || busy}
            onClick={send}
            style={{ borderRadius: "50%" }}
          >
            <Icons.ArrowUp size={16} />
          </button>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--fg-muted)", marginTop: 8 }}>
        Agents can make mistakes. Verify data before sending to a customer.
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
        <EntityIcon size={34} type={rec.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14.5,
              color: "var(--fg-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {rec.name}
          </div>
          <div className="eyebrow" style={{ fontSize: 10 }}>
            {meta.label}
          </div>
        </div>
        <button
          className="icon-btn"
          onClick={() => onOpenRecord(rec)}
          style={{ width: 28, height: 28 }}
          title="Open"
        >
          <Icons.ChevronRight size={16} />
        </button>
        <button
          className="icon-btn"
          onClick={() => onRemove(rec)}
          style={{ width: 28, height: 28 }}
          title="Remove"
        >
          <Icons.X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
        {fields.map((f) => {
          const [label, key, kind] = f;
          let val = rec[key];
          if (kind === "ref") {
            const r = byId(val);
            val = r ? r.name : "-";
          }
          if (kind === "min") {
            val = val ? `${val} min` : "-";
          }
          return (
            <div key={label}>
              <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 2 }}>
                {label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--fg-primary)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {val == null || val === "" ? "-" : String(val)}
              </div>
            </div>
          );
        })}
      </div>
      {rec.type === "meeting" && rec.summary && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
            Summary
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-body)", lineHeight: 1.5 }}>
            {rec.summary}
          </div>
        </div>
      )}
      {["account", "owner", "contact"].includes(rec.type) &&
        (() => {
          const order = ["deal", "meeting", "task", "contact"];
          const chips = [].concat(...order.map((k) => rel[k] || [])).slice(0, 6);
          if (!chips.length) {
            return null;
          }
          return (
            <div
              style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}
            >
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
                Related
              </div>
              <div className="chip-wrap">
                {chips.map((r) => (
                  <RefChip key={r.id} onOpen={onOpenRecord} record={r} />
                ))}
              </div>
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
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icons.Layers size={17} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>Context</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
              {attached.length} record{attached.length === 1 ? "" : "s"} attached
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onAttach}>
            <Icons.Plus size={14} /> Add
          </button>
          <button className="icon-btn ctx-close" onClick={onClose}>
            <Icons.X size={18} />
          </button>
        </div>
        <div className="scroll ctx-scroll" style={{ flex: 1 }}>
          {attached.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 16px" }}>
              <Icons.Inbox size={26} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13.5 }}>
                Attach a deal, account, meeting or contact to ground the chat.
              </div>
            </div>
          )}
          {attached.map((r) => (
            <ContextCard key={r.id} onOpenRecord={onOpenRecord} onRemove={onRemove} rec={r} />
          ))}
        </div>
      </aside>
    </>
  );
}

function contextPreamble(records, files = []) {
  const blocks = [];
  if (records.length) {
    const lines = records
      .map(
        (r) => `- ${ENTITIES[r.type].label}: ${r.name}${subtitleOf(r) ? ` (${subtitleOf(r)})` : ""}`
      )
      .join("\n");
    blocks.push(
      `The user has attached these CRM records. Ground your answer in them and use tools to fetch more detail as needed:\n${lines}`
    );
  }
  // Inlined files carry their full text, embed it directly so the agent
  // answers without any tool call.
  const inline = files.filter((f) => f.text);
  if (inline.length) {
    const docs = inline.map((f) => `### ${f.fileName}\n${f.text}`).join("\n\n");
    blocks.push(
      `The user attached these files; their full contents are included below. Use them directly to answer:\n\n${docs}`
    );
  }
  // DataSource-only files (binary / large): the agent reads them on demand.
  const withId = files.filter((f) => !f.text && f.datasourceId != null);
  if (withId.length) {
    const lines = withId
      .map((f) => `- ${f.fileName} (datasource_id: ${f.datasourceId})`)
      .join("\n");
    blocks.push(
      `The user uploaded these files. Read their contents with the read_file tool (pass the datasource_id) before answering questions about them:\n${lines}`
    );
  }
  return blocks.join("\n\n");
}

function timeAgo(ts) {
  if (!ts) {
    return "";
  }
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) {
    return "just now";
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

// Left slide-over listing past conversations; reopening rehydrates the full
// transcript. Source of truth is the server (AmpUp) when signed in, else
// localStorage. See lib/gtm/conversations.
function HistoryDrawer({ open, onClose, onSelect, activeId }) {
  const [items, setItems] = useState([]);
  const refresh = () =>
    listConversations()
      .then(setItems)
      .catch(() => setItems([]));
  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open]);
  if (!open) {
    return null;
  }
  const remove = async (e, c) => {
    e.stopPropagation();
    await deleteConversation(c);
    refresh();
  };
  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      style={{ justifyContent: "flex-start", zIndex: 96 }}
    >
      <aside className="hist-drawer" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Icons.History size={17} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>
            Chat history
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icons.X size={18} />
          </button>
        </div>
        <div className="scroll" style={{ flex: 1, padding: 8 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "40px 16px" }}>
              <Icons.Chat size={26} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 13.5 }}>
                No past chats yet. Your conversations will appear here.
              </div>
            </div>
          ) : (
            items.map((c) => (
              <div
                className={"hist-item" + (c.id === activeId ? " active" : "")}
                key={c.id}
                onClick={() => onSelect(c)}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="hist-title">{c.title}</div>
                  {c.preview && <div className="hist-preview">{c.preview}</div>}
                  <div className="hist-meta">
                    {timeAgo(c.updatedAt)} · {c.messageCount} message
                    {c.messageCount === 1 ? "" : "s"}
                  </div>
                </div>
                <button className="icon-btn hist-del" onClick={(e) => remove(e, c)} title="Delete">
                  <Icons.X size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

export function ChatScreen({
  seedAttached,
  resume,
  agent,
  onBack,
  onOpenRecord,
  onToast,
  onOpenConversation,
  onNewChat,
  onNav,
}) {
  const conversationId = useMemo(
    () =>
      resume?.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `c-${Date.now()}`),
    []
  );
  const runIdRef = useRef(resume?.runId);
  // AmpUp row id once this conversation is persisted server-side; threaded into
  // subsequent saves so they UPDATE the same row instead of creating new ones.
  const ampupIdRef = useRef(resume?.ampupId);
  // Signature of the last-saved transcript, seeded from the reopened transcript
  // so reopening doesn't immediately re-save unchanged content.
  const lastSavedSigRef = useRef(resume?.messages?.length ? convoSig(resume.messages) : "");
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const [histOpen, setHistOpen] = useState(false);
  const [attached, setAttached] = useState(() => (seedAttached || []).filter(Boolean));
  const [files, setFiles] = useState(() => (agent ? agentFiles(agent) : [])); // { datasourceId, fileName, status }
  const [uploading, setUploading] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxCollapsed, setCtxCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ampup-ctx-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toolPromptDismissed, setToolPromptDismissed] = useState(false);
  const toggleCollapse = () =>
    setCtxCollapsed((v) => {
      const n = !v;
      try {
        localStorage.setItem("ampup-ctx-collapsed", n ? "1" : "0");
      } catch {}
      return n;
    });

  // MCP tools this agent is scoped to but the user hasn't connected yet. Prompt
  // them to connect on open so the agent can actually use those tools. Resolved
  // against the catalog for display names; recomputes when the agent changes
  // (ChatScreen remounts per chat open, so reconnecting then reopening clears it).
  const missingTools = useMemo(() => {
    if (!agent) {
      return [];
    }
    const connected = new Set(enabledMcpServers().map((s) => s.slug));
    const out = [];
    // Explicit servers the agent wants but the user hasn't connected.
    for (const id of Array.isArray(agent.mcpServerIds) ? agent.mcpServerIds : []) {
      if (!connected.has(id)) {
        out.push(MCP_CATALOG.find((c) => c.slug === id) || { slug: id, name: id });
      }
    }
    // Categories with no connected provider: prompt generically ("a call
    // recorder") rather than naming a vendor. Skip categories AmpUp already
    // covers when its built-in CRM is on.
    for (const cat of Array.isArray(agent.mcpCategories) ? agent.mcpCategories : []) {
      if (agent.includeAmpup !== false && AMPUP_COVERS.has(cat)) {
        continue;
      }
      const anyConnected = catalogSlugsForCategories([cat]).some((s) => connected.has(s));
      if (!anyConnected) {
        out.push({ slug: `category:${cat}`, name: CATEGORY_LABELS[cat] || cat });
      }
    }
    return out;
  }, [agent]);
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  const filesRef = useRef(files);
  filesRef.current = files;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url, options) => {
          // Thread the per-user MCP key so the chat backend uses the caller's key,
          // not the shared env fallback (multi-tenant). No-op in single-org dev.
          const k = getMcpKey();
          // Bring-your-own LLM key: the operator's key only powers internal/Pro
          // chats; everyone else sends their own key here (stored locally).
          const llm = getLlmKey();
          const headers = { ...(options?.headers || {}) };
          if (k) {
            headers["x-ampup-mcp-key"] = k;
          }
          if (llm) {
            headers["x-llm-provider"] = llm.provider;
            headers["x-llm-key"] = llm.key;
            if (llm.model) {
              headers["x-llm-model"] = llm.model;
            }
          }
          const res = await fetch(url, { ...options, headers });
          if (res.status === 402) {
            throw new Error("Add your own LLM API key in Settings → API keys to start chatting.");
          }
          const id = res.headers.get("x-workflow-run-id");
          if (id) {
            runIdRef.current = id;
          }
          return res;
        },
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1];
          const pre = contextPreamble(attachedRef.current, filesRef.current);
          const msg = pre
            ? {
                ...last,
                parts: (last.parts || []).map((p) =>
                  p.type === "text" ? { ...p, text: `${pre}\n\n${p.text}` } : p
                ),
              }
            : last;
          const ag = agentRef.current;
          const all = enabledMcpServers();
          // An agent scopes the chat to its server subset (by slug or id); a plain
          // chat exposes every enabled server. The built-in ampup CRM is added
          // server-side unless the agent opts out (includeAmpup=false).
          const servers = agentIsScoped(ag) ? scopeServersForAgent(ag, all) : all;
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
    [conversationId]
  );

  const { messages, sendMessage, status, setMessages, regenerate } = useChat({ transport });
  // The durable run keeps its stream open across turns (preventClose), so the
  // transport `status` never settles back to "ready", it stays "streaming"
  // forever, which would leave the composer disabled and block every follow-up.
  // Derive turn-completion from message stability instead: a turn is busy from
  // send until the assistant's deltas stop arriving.
  const [turnBusy, setTurnBusy] = useState(false);
  const busy = turnBusy;
  useEffect(() => {
    if (!turnBusy) {
      return;
    }
    if (status === "error") {
      setTurnBusy(false);
      return;
    } // failed turn: unblock the composer
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") {
      return; // still awaiting the first assistant token
    }
    // A tool call has a silent gap (no chunks) while it runs, which looks like
    // the turn finished. Don't settle until every tool part on the last message
    // has resolved (same "done" signal TraceRow uses).
    const toolPending = (last.parts || []).some(
      (p) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        p.state !== "output-available" &&
        p.state !== "output-error"
    );
    if (toolPending) {
      return;
    }
    const t = setTimeout(() => setTurnBusy(false), 1100);
    return () => clearTimeout(t);
  }, [messages, turnBusy, status]);
  // Re-engage if the agent fires another tool after appearing to settle (a
  // multi-step turn that narrates between tool calls): an actively-running tool
  // on the last message always means the turn isn't done.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") {
      return;
    }
    const toolRunning = (last.parts || []).some(
      (p) =>
        typeof p.type === "string" &&
        p.type.startsWith("tool-") &&
        p.state !== "output-available" &&
        p.state !== "output-error"
    );
    if (toolRunning) {
      setTurnBusy(true);
    }
  }, [messages]);
  // Stall watchdog. A turn that fails server-side before producing an assistant
  // message (e.g. a model error) leaves `status` stuck on "streaming" (the
  // durable stream stays open) with no assistant message to settle on, so the
  // spinner would run forever. Tool calls are server-bounded (≤45s), and a live
  // turn streams deltas continuously, so any window with NO message activity
  // this long is a genuine stall: settle it and surface an error. The `messages`
  // dep resets the timer on every chunk, so a healthy turn never trips it.
  useEffect(() => {
    if (!turnBusy) {
      return;
    }
    const t = setTimeout(() => {
      setTurnBusy(false);
      onToast?.("That request stalled before completing. Please try again.", "error");
    }, 90_000);
    return () => clearTimeout(t);
  }, [turnBusy, messages]);
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Refresh any OAuth MCP tokens nearing expiry so this conversation starts with
  // a fresh token (long single sessions past expiry should be reopened).
  useEffect(() => {
    refreshOauthServers();
  }, []);
  // Rehydrate a reopened conversation's transcript once on mount.
  useEffect(() => {
    if (resume?.messages?.length) {
      setMessages(resume.messages);
    }
  }, []);
  // Persist the transcript so it shows in History (server-backed + cross-device
  // when signed in, else localStorage). The durable run keeps its stream open
  // across turns (preventClose), so `status` never settles to "ready", instead
  // debounce on message stability: once deltas stop arriving, save the final
  // transcript and remember the AmpUp row id so later saves update it in place.
  useEffect(() => {
    if (turnBusy) {
      return; // wait for the turn to settle: one save per turn, not per chunk
    }
    if (!messages.some((m) => m.role === "user")) {
      return;
    }
    const sig = convoSig(messages);
    if (sig === lastSavedSigRef.current) {
      return; // unchanged (e.g. just reopened)
    }
    const t = setTimeout(() => {
      lastSavedSigRef.current = sig;
      const deal = attachedRef.current.find((r) => r.type === "deal");
      const acct = attachedRef.current.find((r) => r.type === "account");
      saveConversation({
        id: conversationId,
        ampupId: ampupIdRef.current,
        runId: runIdRef.current,
        messages,
        dealId: deal?.id,
        accountId: acct?.id,
      }).then((ampupId) => {
        if (ampupId != null) {
          ampupIdRef.current = ampupId;
        }
      });
    }, 600);
    return () => clearTimeout(t);
  }, [messages, turnBusy, conversationId]);

  const addRec = (r) => setAttached((a) => (a.some((x) => x.id === r.id) ? a : [...a, r]));
  const removeRec = (r) => setAttached((a) => a.filter((x) => x.id !== r.id));
  const fileKey = (f) => f.id ?? f.datasourceId ?? f.fileName;
  const removeFile = (f) => setFiles((fs) => fs.filter((x) => fileKey(x) !== fileKey(f)));
  const clear = () => {
    runIdRef.current = undefined;
    setMessages([]);
    setTurnBusy(false);
  };
  const send = (t) => {
    setTurnBusy(true);
    sendMessage({ text: t });
  };
  const doRegenerate = () => {
    setTurnBusy(true);
    regenerate();
  };

  // Persist a file to the org as an AmpUp DataSource (so it's saved and linked
  // to any attached deal/account). Returns the parsed /api/upload response.
  const persistDataSource = async (file) => {
    const b64 = await fileToBase64(file);
    const deal = attachedRef.current.find((r) => r.type === "deal");
    const acct = attachedRef.current.find((r) => r.type === "account");
    return apiFetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_name: file.name,
        file_content_base64: b64,
        opportunity_id: deal?.id,
        account_id: acct?.id,
      }),
    }).then((r) => r.json());
  };

  const uploadFile = async (file) => {
    if (!file) {
      return;
    }
    const id = `f-${Date.now()}-${file.size}`;
    const linkedName =
      attachedRef.current.find((r) => r.type === "deal")?.name ||
      attachedRef.current.find((r) => r.type === "account")?.name ||
      "";

    // Inline path: read the text in the browser so it's usable INSTANTLY (its
    // content rides the prompt context, no upload round-trip, no read_file).
    // The DataSource is still created in the BACKGROUND for persistence / CRM
    // linking, then backfilled onto the entry; if it fails, inline still works.
    if (isInlineable(file)) {
      let text = "";
      try {
        text = await file.text();
      } catch {
        /* fall through to upload */
      }
      if (text.trim()) {
        setFiles((fs) => [
          ...fs,
          {
            id,
            fileName: file.name,
            text,
            datasourceId: null,
            status: "ready",
            ts: Date.now(),
            linkedName,
          },
        ]);
        onToast(`Attached ${file.name}`, "success");
        void persistDataSource(file)
          .then((res) => {
            if (res?.ok) {
              setFiles((fs) =>
                fs.map((f) => (f.id === id ? { ...f, datasourceId: res.datasourceId } : f))
              );
              addUpload({
                datasourceId: res.datasourceId,
                fileName: file.name,
                ts: Date.now(),
                linkedName,
              });
            }
          })
          .catch((e) => console.warn("background DataSource upload failed:", e));
        return;
      }
    }

    // Fallback: binary / unreadable-as-text / oversized → upload to AmpUp and
    // let the agent read it back with read_file. Blocking, with a spinner.
    if (uploading) {
      return;
    }
    setUploading(true);
    try {
      const res = await persistDataSource(file);
      if (res.ok) {
        const entry = {
          id,
          datasourceId: res.datasourceId,
          fileName: res.fileName,
          status: res.status,
          ts: Date.now(),
          linkedName,
        };
        setFiles((fs) => [...fs.filter((x) => x.datasourceId !== entry.datasourceId), entry]);
        addUpload(entry);
        onToast(`Uploaded ${file.name}, the agent can read it now`, "success");
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
    if (projection.length === 0) {
      onToast("Nothing to share yet, send a message first", "info");
      return;
    }
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: { title, messages: projection } }),
      }).then((r) => r.json());
      if (res.id) {
        const url = `${window.location.origin}/?share=${res.id}`;
        try {
          await navigator.clipboard?.writeText(url);
        } catch {}
        onToast("Public read-only link copied to clipboard", "success");
      } else {
        onToast(res.error ? `Share failed: ${res.error}` : "Could not create share link", "error");
      }
    } catch {
      onToast("Could not create share link", "error");
    }
  };

  const subjectType = attached[0] ? attached[0].type : "none";
  // An agent carries its own starter questions; fall back to the record-type
  // suggestions (or the generic pipeline ones) when none is set or no agent.
  const agentStarters =
    agent && Array.isArray(agent.starterQuestions) ? agent.starterQuestions.filter(Boolean) : [];
  const suggestions = agentStarters.length
    ? agentStarters
    : SUGGESTIONS[subjectType] || SUGGESTIONS.none;
  const title =
    attached.length === 1
      ? attached[0].name
      : attached.length > 1
        ? `${attached.length} records`
        : "your pipeline";
  const empty = messages.length === 0;
  const lastId = messages.length ? messages[messages.length - 1].id : null;

  return (
    <div className="chat-wrap">
      <div className="chat-col">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px var(--pad)",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface)",
            minHeight: 60,
          }}
        >
          <button className="icon-btn" onClick={onBack} title="Back">
            <Icons.ArrowLeft size={18} />
          </button>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: "var(--bg-muted)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--fg-primary)",
              flexShrink: 0,
            }}
          >
            <LogoMark size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: "var(--fg-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {agent ? agent.name : `Chat with ${title}`}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
              {agent
                ? `${agent.tag || "Agent"} · ${attached.length ? `${attached.length} attached · ` : ""}grounded in your data`
                : `${attached.length ? `${attached.length} attached` : "No records attached"} · grounded in your CRM`}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost hide-mobile" onClick={() => setHistOpen(true)}>
            <Icons.History size={14} /> History
          </button>
          <button
            className="btn btn-sm btn-ghost hide-mobile"
            onClick={() => (onNewChat ? onNewChat() : clear())}
          >
            <Icons.Chat size={14} /> New chat
          </button>
          <button className="btn btn-sm btn-outline ctx-toggle" onClick={() => setCtxOpen(true)}>
            <Icons.Panel size={14} /> Context
          </button>
          <button
            className="btn btn-sm btn-outline ctx-collapse-btn"
            onClick={toggleCollapse}
            title={ctxCollapsed ? "Show context panel" : "Hide context panel"}
          >
            <Icons.Panel size={14} /> {ctxCollapsed ? "Show panel" : "Hide panel"}
          </button>
          <button className="btn btn-sm btn-outline hide-mobile" onClick={shareChat}>
            <Icons.Share size={14} /> Share
          </button>
        </div>

        {agent && missingTools.length > 0 && !toolPromptDismissed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px var(--pad)",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--accent-soft)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--accent)", display: "flex", flexShrink: 0 }}>
              <Icons.Plug size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0, color: "var(--fg-secondary)", lineHeight: 1.45 }}>
              <strong style={{ color: "var(--fg-primary)", fontWeight: 600 }}>
                Connect {missingTools.length === 1 ? "a tool" : "tools"} to get the most out of{" "}
                {agent.name}.
              </strong>{" "}
              It uses {missingTools.map((t) => t.name).join(", ")}
              {agent.includeAmpup === false ? "" : " alongside your AmpUp CRM"}. You can still chat
              now, it'll use what's connected.
            </div>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => (onNav ? onNav("connectors") : null)}
              style={{ flexShrink: 0 }}
            >
              <Icons.Plug size={13} /> Connect
            </button>
            <button
              className="icon-btn"
              onClick={() => setToolPromptDismissed(true)}
              style={{ flexShrink: 0 }}
              title="Dismiss"
            >
              <Icons.X size={15} />
            </button>
          </div>
        )}

        <div className="scroll chat-scroll" ref={scrollRef}>
          <div className="chat-inner">
            {empty ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "46vh",
                  textAlign: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "var(--accent-soft)",
                    color: "var(--fg-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <LogoMark size={28} />
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-hero)",
                    fontSize: 26,
                    color: "var(--fg-primary)",
                  }}
                >
                  {agent ? agent.name : `Chat with ${title}`}
                </h3>
                <p
                  style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 440, marginBottom: 6 }}
                >
                  {agent
                    ? agent.desc ||
                      "Ask anything to get started. I reason across your connected sources."
                    : attached.length
                      ? "Ask anything about the attached records. I reason across your connected CRM, calls and notes."
                      : "Attach a record below, or ask about your pipeline. I reason across your connected sources."}
                </p>
                {attached.length > 0 && (
                  <div className="chip-wrap" style={{ justifyContent: "center", marginBottom: 14 }}>
                    {attached.map((r) => (
                      <RefChip key={r.id} onOpen={onOpenRecord} record={r} />
                    ))}
                  </div>
                )}
                <div className="suggest">
                  {suggestions.map((sug, i) => (
                    <button key={i} onClick={() => send(sug)}>
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div className="msg-row msg-user" key={m.id}>
                    <div className="bubble">{textOf(m)}</div>
                  </div>
                ) : (
                  <AgentMessage
                    isLast={m.id === lastId}
                    key={m.id}
                    msg={m}
                    onRegenerate={doRegenerate}
                    onToast={onToast}
                    turnBusy={busy}
                  />
                )
              )
            )}
            {busy && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="msg-row msg-agent">
                <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}>
                  <LogoMark size={17} />
                </div>
                <div className="bubble" style={{ flex: 1, minWidth: 0 }}>
                  <LoadingIndicator />
                </div>
              </div>
            )}
          </div>
        </div>

        <Composer
          attached={attached}
          busy={busy}
          files={files}
          onOpenPicker={() => setPickerOpen(true)}
          onRemove={removeRec}
          onRemoveFile={removeFile}
          onSend={send}
          onUploadFile={uploadFile}
          uploading={uploading}
        />
      </div>

      <ContextPanel
        attached={attached}
        collapsed={ctxCollapsed}
        onAttach={() => setPickerOpen(true)}
        onClose={() => setCtxOpen(false)}
        onOpenRecord={onOpenRecord}
        onRemove={removeRec}
        open={ctxOpen}
      />

      {pickerOpen && (
        <AttachPicker
          attached={attached}
          onClose={() => setPickerOpen(false)}
          onPick={(r) => {
            addRec(r);
            setPickerOpen(false);
          }}
        />
      )}

      <HistoryDrawer
        activeId={conversationId}
        onClose={() => setHistOpen(false)}
        onSelect={(c) => {
          setHistOpen(false);
          if (c.id !== conversationId && onOpenConversation) {
            onOpenConversation(c);
          }
        }}
        open={histOpen}
      />
    </div>
  );
}
