// Add / edit a custom MCP server. The agent discovers this server's tools at the
// start of a new chat and namespaces them mcp__<slug>__<tool>. Shared by the
// Connectors screen and the agent builder.
import { useState } from "react";
import { Icons } from "./icons";

export function McpServerModal({ server, onSave, onClose }) {
  const [name, setName] = useState(server?.name || "");
  const [url, setUrl] = useState(server?.url || "");
  const [token, setToken] = useState(server?.token || "");
  const [authHeader, setAuthHeader] = useState(server?.authHeader || "");
  const [test, setTest] = useState(null); // { ok, toolCount, sample, error } | "loading"
  const canSave = name.trim() && /^https?:\/\//i.test(url.trim());

  const runTest = async () => {
    setTest("loading");
    try {
      const res = await fetch("/api/mcp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          token: token.trim(),
          authHeader: authHeader.trim(),
        }),
      }).then((r) => r.json());
      setTest(res);
    } catch {
      setTest({ ok: false, error: "Could not reach the server" });
    }
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
    <div
      className="sheet-backdrop"
      onClick={onClose}
      style={{ alignItems: "center", justifyContent: "center", zIndex: 97 }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 94vw)",
          maxHeight: "90vh",
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
          <Icons.Plug size={18} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>
            {server?.id ? "Edit" : "Add"} MCP server
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
          <div>
            <label style={label}>Name</label>
            <input
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Linear, GitHub, my-tools"
              style={field}
              value={name}
            />
          </div>
          <div>
            <label style={label}>Server URL</label>
            <input
              onChange={(e) => {
                setUrl(e.target.value);
                setTest(null);
              }}
              placeholder="https://mcp.example.com/mcp"
              style={field}
              value={url}
            />
          </div>
          <div>
            <label style={label}>
              Auth token{" "}
              <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>(optional)</span>
            </label>
            <input
              onChange={(e) => {
                setToken(e.target.value);
                setTest(null);
              }}
              placeholder="Sent as Bearer token"
              style={field}
              type="password"
              value={token}
            />
          </div>
          <div>
            <label style={label}>
              Auth header{" "}
              <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>
                (optional, default Authorization: Bearer)
              </span>
            </label>
            <input
              onChange={(e) => {
                setAuthHeader(e.target.value);
                setTest(null);
              }}
              placeholder="Authorization"
              style={field}
              value={authHeader}
            />
          </div>
          {test && test !== "loading" && (
            <div
              style={{
                fontSize: 12.5,
                padding: "9px 11px",
                borderRadius: 9,
                background: test.ok ? "var(--mint-glow-subtle)" : "var(--accent-soft)",
                color: test.ok ? "var(--fg-success)" : "var(--fg-primary)",
              }}
            >
              {test.ok ? (
                <>
                  Connected — {test.toolCount} tool{test.toolCount === 1 ? "" : "s"} found
                  {test.sample?.length
                    ? `: ${test.sample.join(", ")}${test.toolCount > test.sample.length ? "…" : ""}`
                    : ""}
                  .
                </>
              ) : (
                <>Couldn’t connect: {test.error || "unknown error"}.</>
              )}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Supports API-key / bearer-token auth (interactive OAuth isn’t supported yet). The token
            is stored in your browser and sent securely with each chat request — it never enters the
            app build.
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
          <button
            className="btn btn-sm btn-outline"
            disabled={!/^https?:\/\//i.test(url.trim()) || test === "loading"}
            onClick={runTest}
          >
            {test === "loading" ? (
              <Icons.Refresh className="spin" size={14} />
            ) : (
              <Icons.Plug size={14} />
            )}{" "}
            Test connection
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-sm btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({
                ...server,
                name: name.trim(),
                url: url.trim(),
                token: token.trim(),
                authHeader: authHeader.trim(),
              })
            }
          >
            <Icons.Save size={14} /> Save server
          </button>
        </div>
      </div>
    </div>
  );
}
