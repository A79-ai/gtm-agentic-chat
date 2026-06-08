// Connectors gallery screen
import React, { useState, useEffect, Suspense } from "react";
import { Icons } from "./icons";
import { ConnLogo } from "./ui";
import { CAT_TABS, getAmpersand, setConnectors, getConnectors } from "@/lib/gtm/data";
import { listMcpServers, saveMcpServer, deleteMcpServer, setMcpServerEnabled } from "@/lib/gtm/mcpServers";

const AmpersandConnect = React.lazy(() => import("./AmpersandConnect"));

// Add / edit a custom MCP server. The agent discovers this server's tools at the
// start of a new chat and namespaces them mcp__<slug>__<tool>.
function McpServerModal({ server, onSave, onClose }) {
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
        body: JSON.stringify({ url: url.trim(), token: token.trim(), authHeader: authHeader.trim() }),
      }).then((r) => r.json());
      setTest(res);
    } catch {
      setTest({ ok: false, error: "Could not reach the server" });
    }
  };

  const field = { width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--fg-primary)", fontSize: 13.5 };
  const label = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)", marginBottom: 6 };

  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center", zIndex: 95 }} onClick={onClose}>
      <div className="card" style={{ width: "min(520px, 94vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Icons.Plug size={18} style={{ color: "var(--fg-muted)" }} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>{server ? "Edit" : "Add"} MCP server</div>
          <button className="icon-btn" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div style={{ padding: 16, flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>Name</label>
            <input style={field} placeholder="e.g. Linear, GitHub, my-tools" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={label}>Server URL</label>
            <input style={field} placeholder="https://mcp.example.com/mcp" value={url} onChange={(e) => { setUrl(e.target.value); setTest(null); }} />
          </div>
          <div>
            <label style={label}>Auth token <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>(optional)</span></label>
            <input style={field} type="password" placeholder="Sent as Bearer token" value={token} onChange={(e) => { setToken(e.target.value); setTest(null); }} />
          </div>
          <div>
            <label style={label}>Auth header <span style={{ fontWeight: 400, color: "var(--fg-muted)" }}>(optional, default Authorization: Bearer)</span></label>
            <input style={field} placeholder="Authorization" value={authHeader} onChange={(e) => { setAuthHeader(e.target.value); setTest(null); }} />
          </div>
          {test && test !== "loading" && (
            <div style={{ fontSize: 12.5, padding: "9px 11px", borderRadius: 9, background: test.ok ? "var(--mint-glow-subtle)" : "var(--accent-soft)", color: test.ok ? "var(--fg-success)" : "var(--fg-primary)" }}>
              {test.ok
                ? <>Connected — {test.toolCount} tool{test.toolCount === 1 ? "" : "s"} found{test.sample?.length ? `: ${test.sample.join(", ")}${test.toolCount > test.sample.length ? "…" : ""}` : ""}.</>
                : <>Couldn’t connect: {test.error || "unknown error"}.</>}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            The token is stored in your browser and sent securely with each chat request. It never enters the app build.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <button className="btn btn-sm btn-outline" disabled={!/^https?:\/\//i.test(url.trim()) || test === "loading"} onClick={runTest}>
            {test === "loading" ? <Icons.Refresh size={14} className="spin" /> : <Icons.Plug size={14} />} Test connection
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" disabled={!canSave} onClick={() => onSave({ ...server, name: name.trim(), url: url.trim(), token: token.trim(), authHeader: authHeader.trim() })}>
            <Icons.Save size={14} /> Save server
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomMcpSection() {
  const [servers, setServers] = useState([]);
  const [editing, setEditing] = useState(null); // server | "new" | null
  useEffect(() => { setServers(listMcpServers()); }, []);
  const refresh = () => setServers(listMcpServers());
  const onSave = (s) => { saveMcpServer(s); setEditing(null); refresh(); };
  const remove = (s) => { deleteMcpServer(s.id); refresh(); };
  const toggle = (s) => { setMcpServerEnabled(s.id, !(s.enabled !== false)); refresh(); };

  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Custom MCP</div>
          <h3 style={{ fontSize: 20, marginBottom: 4 }}>Bring your own MCP servers</h3>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)", maxWidth: 560 }}>Connect any Model Context Protocol server. Its tools become available to the agent in new chats, alongside your CRM.</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setEditing("new")}><Icons.Plus size={15} /> Add MCP server</button>
      </div>
      {servers.length === 0 ? (
        <button className="card" onClick={() => setEditing("new")} style={{ border: "1.5px dashed var(--border-default)", background: "transparent", padding: "26px 16px", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--fg-muted)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Plug size={22} /></div>
          <div style={{ fontWeight: 500, fontSize: 14, color: "var(--fg-secondary)" }}>No custom MCP servers yet — add one</div>
        </button>
      ) : (
        <div className="conn-grid">
          {servers.map((s) => {
            const on = s.enabled !== false;
            return (
              <div key={s.id} className={"card conn-card" + (on ? " connected" : "")}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-muted)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-primary)", flexShrink: 0 }}><Icons.Plug size={18} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>MCP</span>
                      <span className="badge" style={{ padding: "2px 8px", fontSize: 11, fontFamily: "var(--font-mono)" }}>{s.slug}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, flex: 1, wordBreak: "break-all" }}>{s.url}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => toggle(s)} title={on ? "Disable" : "Enable"}>
                    {on ? <><Icons.CheckCircle size={14} /> Enabled</> : <>Disabled</>}
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => setEditing(s)}><Icons.Sliders size={15} /></button>
                  <button className="icon-btn" title="Remove" onClick={() => remove(s)}><Icons.X size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <McpServerModal server={editing === "new" ? null : editing} onSave={onSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

// CRM connectors are Enterprise-only (self-serve connect is gated behind sales).
const isEnterprise = (c) => c.cat === "CRM";

function ConnectorCard({ c, onConnect, onContact, onManage }) {
  const connected = c.connected;
  const enterprise = isEnterprise(c);
  // Enterprise connections stay read-only; self-serve ones can be managed
  // (Ampersand surfaces the disconnect/uninstall flow when already installed).
  const manageable = connected && !enterprise && c.ampersandName;
  return (
    <div className={"card conn-card" + (connected ? " connected" : "")}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ConnLogo logo={c.logo} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-primary)" }}>{c.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>{c.cat}</span>
            {enterprise && <span className="badge badge-enterprise" style={{ padding: "2px 8px", fontSize: 11 }}>Enterprise</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.5, flex: 1 }}>{c.desc}</div>
      <div>
        {connected ? (
          manageable ? (
            <button className="btn btn-sm conn-manage" onClick={() => onManage(c)} title="Manage or disconnect">
              <Icons.CheckCircle size={15} /> Connected <Icons.Sliders size={13} style={{ marginLeft: 2, opacity: 0.7 }} />
            </button>
          ) : (
            <span className="btn btn-sm" style={{ background: "var(--mint-glow-subtle)", color: "var(--fg-success)", border: "1px solid transparent", cursor: "default" }}>
              <Icons.CheckCircle size={15} /> Connected
            </span>
          )
        ) : enterprise ? (
          <button className="btn btn-sm btn-outline" onClick={() => onContact(c)}>
            <Icons.Spark size={14} /> Contact sales
          </button>
        ) : (
          <button className="btn btn-sm btn-outline" onClick={() => onConnect(c)}>
            <Icons.Plug size={14} /> Connect
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectModal({ connector, amp, mode = "connect", onClose, onToast }) {
  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="card" style={{ width: mode === "manage" ? "min(880px, 94vw)" : "min(560px, 92vw)", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <ConnLogo logo={connector.logo} size={32} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>{mode === "manage" ? "Manage" : "Connect"} {connector.name}</div>
          <button className="icon-btn" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div style={{ padding: 16, flex: 1, overflow: "auto" }}>
          <Suspense fallback={<div style={{ padding: 24, textAlign: "center", color: "var(--fg-muted)" }}>Loading…</div>}>
            <AmpersandConnect
              integration={connector.ampersandName || connector.provider || connector.id}
              project={amp.projectId}
              apiKey={amp.apiKey}
              groupRef={amp.groupRef}
              consumerRef={amp.consumerRef}
              onToast={onToast}
              onDone={onClose}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function ConnectorsScreen({ connectors, onToast }) {
  const [tab, setTab] = useState("All");
  const [connecting, setConnecting] = useState(null); // { connector, mode }
  const [conns, setConns] = useState(connectors);
  useEffect(() => { setConns(connectors); }, [connectors]);
  const amp = getAmpersand();
  const list = conns.filter((c) => tab === "All" || c.cat === tab);
  const connectedCount = conns.filter((c) => c.connected).length;

  // Re-pull the live catalog + connection state (after a connect/disconnect).
  const refetch = () =>
    fetch("/api/connectors")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) { setConnectors(data); setConns(getConnectors()); } })
      .catch(() => {});

  const onConnect = (c) => {
    if (amp.configured && amp.apiKey) setConnecting({ connector: c, mode: "connect" });
    else onToast("Ampersand isn't configured for this org yet — set sales_agent.ampersand_project_id / ampersand_api_key.", "info");
  };
  const onManage = (c) => {
    if (amp.configured && amp.apiKey) setConnecting({ connector: c, mode: "manage" });
    else onToast("Ampersand isn't configured for this org yet.", "info");
  };
  const onContact = (c) => onToast(`${c.name} is an Enterprise connector — contact sales to enable it.`, "info");

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Org tools</div>
            <h2 style={{ marginBottom: 6 }}>Connect your stack</h2>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 520 }}>Wire up CRM, call recordings and notes. Every agent reasons over exactly what you connect here.</p>
          </div>
          <div className="badge badge-success" style={{ height: "fit-content", padding: "6px 12px" }}>
            <Icons.Check size={14} /> {connectedCount} of {connectors.length} connected
          </div>
        </div>

        <div className="scroll hide-scrollbar" style={{ overflowX: "auto", marginBottom: 20, paddingBottom: 2 }}>
          <div className="pilltabs">
            {CAT_TABS.map((t) => <button key={t} className={"pilltab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>)}
          </div>
        </div>

        <div className="conn-grid">{list.map((c) => <ConnectorCard key={c.id} c={c} onConnect={onConnect} onContact={onContact} onManage={onManage} />)}</div>

        <CustomMcpSection />
      </div>
      {connecting && (
        <ConnectModal
          connector={connecting.connector}
          amp={amp}
          mode={connecting.mode}
          onClose={() => { setConnecting(null); refetch(); }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
