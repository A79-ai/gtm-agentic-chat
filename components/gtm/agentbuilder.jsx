// Agent builder: define a chat persona, a system prompt, a scoped set of MCP
// servers, and (optional) attached files. Saved to the local agent registry.
import { useRef, useState } from "react";
import { deleteAgent, isSystemAgent, saveAgent } from "@/lib/gtm/agents";
import { apiFetch } from "@/lib/gtm/auth";
import { addUpload, getUploads } from "@/lib/gtm/data";
import { listMcpServers, saveMcpServer } from "@/lib/gtm/mcpServers";
import { Icons } from "./icons";
import { McpServerModal } from "./McpServerModal";
import { TONES } from "./ui";

const ICONS = ["Spark", "Target", "Phone", "Mail", "Building", "Activity", "Brain", "Zap"];
const TONE_KEYS = ["gold", "teal", "mint"];

export function AgentBuilder({ agent, onSave, onClose, onDeleted, onOpenConnectors }) {
  const editing = agent && agent.id;
  const [name, setName] = useState(agent?.name || "");
  const [desc, setDesc] = useState(agent?.desc || "");
  const [tag, setTag] = useState(agent?.tag || "Custom");
  const [prompt, setPrompt] = useState(agent?.systemPrompt || "");
  const [icon, setIcon] = useState(agent?.icon || "Spark");
  const [tone, setTone] = useState(agent?.tone || "gold");
  const [includeAmpup, setIncludeAmpup] = useState(agent?.includeAmpup !== false);
  const [serverIds, setServerIds] = useState(() => new Set(agent?.mcpServerIds || []));
  const [fileIds, setFileIds] = useState(() => new Set(agent?.fileIds || []));

  const [servers, setServers] = useState(() => listMcpServers());
  const [uploads, setUploads] = useState(() => getUploads());
  const [mcpModal, setMcpModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const _fileRef = useRef(null);
  const canSave = name.trim() && prompt.trim();

  // Inline-add an MCP server, then select it for this agent.
  const addServer = (s) => {
    const rec = saveMcpServer(s);
    setServers(listMcpServers());
    setServerIds((prev) => new Set(prev).add(rec.slug));
    setMcpModal(false);
  };

  // Inline-upload a file (same path as the chat composer), then attach it.
  const uploadFile = async (file) => {
    if (!file || uploading) {
      return;
    }
    setUploading(true);
    setUploadErr("");
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] || "");
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const res = await apiFetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_name: file.name, file_content_base64: b64 }),
      }).then((r) => r.json());
      if (res.ok) {
        addUpload({
          datasourceId: res.datasourceId,
          fileName: res.fileName,
          status: res.status,
          ts: Date.now(),
        });
        setUploads(getUploads());
        setFileIds((prev) => new Set(prev).add(res.datasourceId));
      } else {
        setUploadErr(res.error || "Upload failed");
      }
    } catch {
      setUploadErr("Upload failed");
    }
    setUploading(false);
  };

  const toggle = (set, setFn, key) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setFn(next);
  };

  const editingSystem = editing && isSystemAgent(agent.id);
  const save = () => {
    const rec = saveAgent({
      ...(agent || {}),
      id: agent?.id,
      name: name.trim(),
      desc: desc.trim(),
      tag: tag.trim() || "Custom",
      systemPrompt: prompt.trim(),
      icon,
      tone,
      includeAmpup,
      mcpServerIds: [...serverIds],
      fileIds: [...fileIds],
    });
    onSave(rec);
  };

  const field = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 9,
    border: "1px solid var(--border-default)",
    background: "var(--bg-surface)",
    color: "var(--fg-primary)",
    fontSize: 13.5,
  };
  const label = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--fg-secondary)",
    marginBottom: 6,
  };

  return (
    <>
      <div
        className="sheet-backdrop"
        onClick={onClose}
        style={{ alignItems: "center", justifyContent: "center", zIndex: 95 }}
      >
        <div
          className="card"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "min(620px, 95vw)",
            maxHeight: "92vh",
            display: "flex",
            flexDirection: "column",
            padding: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <Icons.Spark size={18} style={{ color: "var(--fg-muted)" }} />
            <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>
              {editing ? "Edit agent" : "Create an agent"}
            </div>
            <button className="icon-btn" onClick={onClose}>
              <Icons.X size={18} />
            </button>
          </div>

          <div
            style={{
              padding: 16,
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Name</label>
                <input
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Renewal Risk Analyst"
                  style={field}
                  value={name}
                />
              </div>
              <div style={{ width: 150 }}>
                <label style={label}>Tag</label>
                <input
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Custom"
                  style={field}
                  value={tag}
                />
              </div>
            </div>

            <div>
              <label style={label}>Short description</label>
              <input
                onChange={(e) => setDesc(e.target.value)}
                placeholder="One line shown on the agent card"
                style={field}
                value={desc}
              />
            </div>

            <div>
              <label style={label}>System prompt</label>
              <textarea
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the agent's role, what data to pull, and how to respond."
                style={{ ...field, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
                value={prompt}
              />
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div>
                <label style={label}>Icon</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ICONS.map((k) => {
                    const I = Icons[k] || Icons.Spark;
                    return (
                      <button
                        className="icon-btn"
                        key={k}
                        onClick={() => setIcon(k)}
                        style={{
                          width: 34,
                          height: 34,
                          border:
                            icon === k
                              ? "1.5px solid var(--accent)"
                              : "1px solid var(--border-subtle)",
                          color: icon === k ? "var(--fg-primary)" : "var(--fg-muted)",
                        }}
                      >
                        <I size={17} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={label}>Accent</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TONE_KEYS.map((k) => {
                    const tn = TONES[k] || TONES.gold;
                    return (
                      <button
                        key={k}
                        onClick={() => setTone(k)}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: tn.bg,
                          color: tn.fg,
                          border:
                            tone === k
                              ? "2px solid var(--accent)"
                              : "1px solid var(--border-subtle)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={k}
                      >
                        {tone === k && <Icons.Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label style={label}>Data &amp; tools</label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 11px",
                  borderRadius: 9,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                  fontSize: 13.5,
                }}
              >
                <input
                  checked={includeAmpup}
                  onChange={(e) => setIncludeAmpup(e.target.checked)}
                  type="checkbox"
                />
                <span style={{ flex: 1 }}>
                  Your CRM &amp; meetings{" "}
                  <span style={{ color: "var(--fg-muted)" }}>(built-in)</span>
                </span>
              </label>
              {servers.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {servers.map((s) => (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "9px 11px",
                        borderRadius: 9,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--bg-surface)",
                        cursor: "pointer",
                        fontSize: 13.5,
                      }}
                    >
                      <input
                        checked={serverIds.has(s.slug)}
                        onChange={() => toggle(serverIds, setServerIds, s.slug)}
                        type="checkbox"
                      />
                      <Icons.Plug size={14} style={{ color: "var(--fg-muted)" }} />
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span
                        className="badge"
                        style={{
                          padding: "2px 7px",
                          fontSize: 10.5,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {s.slug}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <button className="btn btn-sm btn-outline" onClick={() => setMcpModal(true)}>
                  <Icons.Plus size={14} /> Add MCP server
                </button>
                {onOpenConnectors && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={onOpenConnectors}
                    style={{ fontSize: 12.5, color: "var(--fg-muted)" }}
                  >
                    Manage in Connectors <Icons.ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <label style={{ ...label, marginBottom: 0, flex: 1 }}>
                  Attached files{" "}
                  <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>
                    (injected as context)
                  </span>
                </label>
                <button
                  className="btn btn-sm btn-outline"
                  disabled={uploading}
                  onClick={() => {
                    if (uploading) {
                      return;
                    }
                    const input = document.createElement("input");
                    input.type = "file";
                    input.style.cssText = "position:fixed;left:-9999px;top:0;";
                    input.addEventListener("change", () => {
                      const f = input.files && input.files[0];
                      if (f) {
                        uploadFile(f);
                      }
                      try {
                        document.body.removeChild(input);
                      } catch {}
                    });
                    document.body.appendChild(input);
                    input.click();
                  }}
                  type="button"
                >
                  {uploading ? (
                    <Icons.Refresh className="spin" size={14} />
                  ) : (
                    <Icons.Paperclip size={14} />
                  )}{" "}
                  {uploading ? "Uploading…" : "Upload file"}
                </button>
              </div>
              {uploadErr && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--fg-primary)",
                    background: "var(--accent-soft)",
                    padding: "7px 10px",
                    borderRadius: 8,
                    marginBottom: 6,
                  }}
                >
                  {uploadErr}
                </div>
              )}
              {uploads.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  No files yet. Upload one to ground this agent in your own documents.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxHeight: 140,
                    overflow: "auto",
                  }}
                >
                  {uploads.map((f) => (
                    <label
                      key={f.datasourceId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "9px 11px",
                        borderRadius: 9,
                        border: "1px solid var(--border-subtle)",
                        background: "var(--bg-surface)",
                        cursor: "pointer",
                        fontSize: 13.5,
                      }}
                    >
                      <input
                        checked={fileIds.has(f.datasourceId)}
                        onChange={() => toggle(fileIds, setFileIds, f.datasourceId)}
                        type="checkbox"
                      />
                      <Icons.Paperclip size={14} style={{ color: "var(--fg-muted)" }} />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {f.fileName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {editing && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  deleteAgent(agent.id);
                  onDeleted?.(agent.id);
                }}
                style={{ color: "var(--fg-danger, var(--accent))" }}
              >
                {editingSystem ? "Reset to default" : "Delete"}
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" disabled={!canSave} onClick={save}>
              <Icons.Save size={14} /> {editing ? "Save changes" : "Create agent"}
            </button>
          </div>
        </div>
      </div>
      {mcpModal && (
        <McpServerModal onClose={() => setMcpModal(false)} onSave={addServer} server={null} />
      )}
    </>
  );
}
