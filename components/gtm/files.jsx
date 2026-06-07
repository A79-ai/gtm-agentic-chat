// Files — lists files uploaded from this client (chat composer). There is no
// global datasource-list MCP tool, so this surface is scoped to local session
// uploads; each row carries the datasource_id the agent reads with read_file.
import React, { useEffect, useState } from "react";
import { Icons } from "./icons";
import { getUploads } from "@/lib/gtm/data";

function fmtTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

export function FilesScreen({ onNewChat }) {
  const [files, setFiles] = useState([]);
  useEffect(() => { setFiles(getUploads()); }, []);

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Knowledge</div>
            <h2 style={{ marginBottom: 6 }}>Files</h2>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 560 }}>
              Files you upload in chat become knowledge the agent can read. Attach a deal or account first to link the file to it.
            </p>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => onNewChat([])}><Icons.Plus size={14} /> Upload in a new chat</button>
        </div>

        {files.length === 0 ? (
          <div className="card" style={{ padding: 44, textAlign: "center", color: "var(--fg-muted)" }}>
            <Icons.Paperclip size={28} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>No files yet. Open a chat and use the clip in the composer to upload one.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {files.map((f, i) => (
              <div key={f.datasourceId ?? i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderTop: i ? "1px solid var(--border-subtle)" : "none" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-secondary)", flexShrink: 0 }}>
                  <Icons.Paperclip size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.fileName}</div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
                    {f.linkedName ? `Linked to ${f.linkedName} · ` : ""}{fmtTime(f.ts)}{f.datasourceId != null ? ` · datasource ${f.datasourceId}` : ""}
                  </div>
                </div>
                <span className="badge badge-success" style={{ padding: "4px 10px", flexShrink: 0 }}>
                  <Icons.Check size={13} /> Readable
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
