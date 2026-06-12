// Connectors gallery screen
import React, { Suspense, useEffect, useState } from "react";
import { ampersandGroupRef, apiFetch, seedInstallation, useMcpKeyContext } from "@/lib/gtm/auth";
import { syncFor, useConnectorSync } from "@/lib/gtm/connectorSync";
import { CAT_TABS, getAmpersand, getConnectors, setConnectors } from "@/lib/gtm/data";
import { AUTH_LABEL, MCP_CATALOG } from "@/lib/gtm/mcpCatalog";
import {
  deleteMcpServer,
  listMcpServers,
  saveMcpServer,
  setMcpServerEnabled,
} from "@/lib/gtm/mcpServers";
import { Icons } from "./icons";
import { McpServerModal } from "./McpServerModal";
import { ConnLogo, SyncIndicator } from "./ui";

const AmpersandConnect = React.lazy(() => import("./AmpersandConnect"));

// Brand logo via Google's favicon service (same approach as the agentapp),
// falling back to a generic plug icon if the domain has no favicon / fails.
function McpLogo({ domain, size = 38 }) {
  const [err, setErr] = useState(false);
  const inner = Math.round(size * 0.55);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--fg-primary)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {domain && !err ? (
        <img
          alt=""
          height={inner}
          onError={() => setErr(true)}
          src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
          style={{ borderRadius: 4 }}
          width={inner}
        />
      ) : (
        <Icons.Plug size={inner} />
      )}
    </div>
  );
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A user's saved custom MCP server, rendered in the unified grid.
function McpServerCard({ s, onToggle, onEdit, onRemove }) {
  const on = s.enabled !== false;
  return (
    <div className={"card conn-card" + (on ? " connected" : "")}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <McpLogo domain={domainOf(s.url)} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: "var(--fg-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {s.name}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>
              MCP
            </span>
            <span
              className="badge"
              style={{ padding: "2px 8px", fontSize: 11, fontFamily: "var(--font-mono)" }}
            >
              {s.slug}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--fg-muted)",
          lineHeight: 1.5,
          flex: 1,
          wordBreak: "break-all",
        }}
      >
        {s.url}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onToggle(s)}
          title={on ? "Disable" : "Enable"}
        >
          {on ? (
            <>
              <Icons.CheckCircle size={14} /> Enabled
            </>
          ) : (
            <>Disabled</>
          )}
        </button>
        <button className="icon-btn" onClick={() => onEdit(s)} title="Edit">
          <Icons.Sliders size={15} />
        </button>
        <button className="icon-btn" onClick={() => onRemove(s)} title="Remove">
          <Icons.X size={15} />
        </button>
      </div>
    </div>
  );
}

// A recommended GTM MCP server from the catalog. API-key servers prefill the
// Add modal; OAuth servers with a hosted endpoint that supports dynamic client
// registration can connect via the OAuth popup; the rest (no endpoint, or no
// DCR like HubSpot) stay "OAuth: soon" + Docs.
function McpCatalogCard({ i, onAdd, onConnect }) {
  const oauth = i.auth === "oauth";
  const oauthConnectable = oauth && !!i.url && !i.noDcr;
  return (
    <div className="card conn-card">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <McpLogo domain={i.domain} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-primary)" }}>{i.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>
              MCP
            </span>
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>
              {i.category}
            </span>
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>
              {AUTH_LABEL[i.auth] || i.auth}
            </span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.5, flex: 1 }}>
        {i.desc}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {oauthConnectable ? (
          <button className="btn btn-sm btn-outline" onClick={() => onConnect(i)}>
            <Icons.Plug size={14} /> Connect
          </button>
        ) : oauth ? (
          <span
            className="btn btn-sm"
            style={{
              background: "var(--bg-muted)",
              color: "var(--fg-muted)",
              border: "1px solid var(--border-subtle)",
              cursor: "default",
            }}
            title="This server needs a pre-registered OAuth app. Use Docs to set it up"
          >
            <Icons.Spark size={13} /> OAuth: soon
          </span>
        ) : (
          <button className="btn btn-sm btn-outline" onClick={() => onAdd(i)}>
            <Icons.Plus size={14} /> Add
          </button>
        )}
        {i.docsUrl && (
          <a
            className="btn btn-sm btn-ghost"
            href={i.docsUrl}
            rel="noreferrer"
            style={{ fontSize: 12.5, color: "var(--fg-muted)" }}
            target="_blank"
          >
            Docs
          </a>
        )}
      </div>
    </div>
  );
}

// CRM connectors are Enterprise-only (self-serve connect is gated behind sales).
const isEnterprise = (c) => c.cat === "CRM";

function ConnectorCard({ c, sync, onConnect, onContact, onManage }) {
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
            <span className="badge" style={{ padding: "2px 8px", fontSize: 11 }}>
              {c.cat}
            </span>
            {enterprise && (
              <span className="badge badge-enterprise" style={{ padding: "2px 8px", fontSize: 11 }}>
                Enterprise
              </span>
            )}
            {connected && <SyncIndicator entry={sync} />}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.5, flex: 1 }}>
        {c.desc}
      </div>
      <div>
        {connected ? (
          manageable ? (
            <button
              className="btn btn-sm conn-manage"
              onClick={() => onManage(c)}
              title="Manage or disconnect"
            >
              <Icons.CheckCircle size={15} /> Connected{" "}
              <Icons.Sliders size={13} style={{ marginLeft: 2, opacity: 0.7 }} />
            </button>
          ) : (
            <span
              className="btn btn-sm"
              style={{
                background: "var(--mint-glow-subtle)",
                color: "var(--fg-success)",
                border: "1px solid transparent",
                cursor: "default",
              }}
            >
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
  // User-scoped installs (e.g. Google in a free-trial org) connect at
  // `org_id:user_id` so each user connects their own account; org-scoped tools
  // (Slack, enterprise CRM) keep the org ref.
  const { userId, orgId } = useMcpKeyContext();
  const gref = ampersandGroupRef(orgId || amp.groupRef, userId, connector.scope) || amp.groupRef;
  const cref = connector.scope === "user" && userId ? userId : amp.consumerRef;
  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      style={{ alignItems: "center", justifyContent: "center" }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: mode === "manage" ? "min(880px, 94vw)" : "min(560px, 92vw)",
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
          <ConnLogo logo={connector.logo} size={32} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>
            {mode === "manage" ? "Manage" : "Connect"} {connector.name}
          </div>
          <button className="icon-btn" onClick={onClose}>
            <Icons.X size={18} />
          </button>
        </div>
        <div style={{ padding: 16, flex: 1, overflow: "auto" }}>
          <Suspense
            fallback={
              <div style={{ padding: 24, textAlign: "center", color: "var(--fg-muted)" }}>
                Loading…
              </div>
            }
          >
            <AmpersandConnect
              apiKey={amp.apiKey}
              consumerRef={cref}
              groupRef={gref}
              integration={connector.ampersandName || connector.provider || connector.id}
              onDone={onClose}
              onInstalled={(id, config) =>
                seedInstallation(id, config, {
                  integration: connector.ampersandName || connector.provider || connector.id,
                  groupRef: gref,
                  provider: connector.provider || connector.id,
                })
              }
              onToast={onToast}
              project={amp.projectId}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function ConnectorsScreen({ connectors, onToast }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [connecting, setConnecting] = useState(null); // { connector, mode }
  const [conns, setConns] = useState(connectors);
  const [servers, setServers] = useState([]);
  const [mcpEditing, setMcpEditing] = useState(null); // null | "new" | server(edit) | {name,url}(prefill)
  useEffect(() => {
    setConns(connectors);
  }, [connectors]);
  useEffect(() => {
    setServers(listMcpServers());
  }, []);
  const { sync } = useConnectorSync();
  const amp = getAmpersand();

  const refreshServers = () => setServers(listMcpServers());
  const onMcpSave = (s) => {
    saveMcpServer(s);
    setMcpEditing(null);
    refreshServers();
  };
  const onMcpRemove = (s) => {
    deleteMcpServer(s.id);
    refreshServers();
  };
  const onMcpToggle = (s) => {
    setMcpServerEnabled(s.id, !(s.enabled !== false));
    refreshServers();
  };

  // OAuth connect: open the provider consent in a popup; the callback posts the
  // resulting server config back, which we save to the registry.
  const onOauthConnect = (item) => {
    const w = 520,
      h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      `/api/mcp/oauth/start?url=${encodeURIComponent(item.url)}&name=${encodeURIComponent(item.name)}`,
      "mcp-oauth",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    const onMessage = (ev) => {
      if (ev.origin !== window.location.origin || !ev.data || typeof ev.data !== "object") {
        return;
      }
      if (ev.data.type === "mcp-oauth-success" && ev.data.server) {
        saveMcpServer(ev.data.server);
        refreshServers();
        onToast(`Connected ${item.name}`, "success");
        cleanup();
      } else if (ev.data.type === "mcp-oauth-error") {
        onToast(`Couldn't connect ${item.name}: ${ev.data.error || "OAuth failed"}`, "error");
        cleanup();
      }
    };
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      try {
        popup && popup.close();
      } catch {}
    };
    window.addEventListener("message", onMessage);
  };

  // Re-pull the live catalog + connection state (after a connect/disconnect).
  const refetch = () =>
    apiFetch("/api/connectors")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setConnectors(data);
          setConns(getConnectors());
        }
      })
      .catch(() => {});

  const onConnect = (c) => {
    if (amp.configured && amp.apiKey) {
      setConnecting({ connector: c, mode: "connect" });
    } else {
      onToast(
        "Ampersand isn't configured for this org yet. Set sales_agent.ampersand_project_id / ampersand_api_key.",
        "info"
      );
    }
  };
  const onManage = (c) => {
    if (amp.configured && amp.apiKey) {
      setConnecting({ connector: c, mode: "manage" });
    } else {
      onToast("Ampersand isn't configured for this org yet.", "info");
    }
  };
  const onContact = (c) =>
    onToast(`${c.name} is an Enterprise connector. Contact sales to enable it.`, "info");

  // One unified, searchable list: Ampersand integrations, your custom MCP
  // servers, then recommended MCP servers. Custom + recommended are tab-category
  // "MCP"; search matches name/description across all three.
  const q = query.trim().toLowerCase();
  const matches = (...fields) => !q || fields.some((f) => (f || "").toLowerCase().includes(q));
  const showMcp = tab === "All" || tab === "MCP";

  // Connected connectors render first; available ones after. Stable within each
  // group (relies on Array.prototype.sort being stable in modern runtimes).
  const ampList = conns
    .filter((c) => (tab === "All" || c.cat === tab) && matches(c.name, c.desc))
    .sort((a, b) => (b.connected ? 1 : 0) - (a.connected ? 1 : 0));
  const customList = showMcp ? servers.filter((s) => matches(s.name, s.url, s.slug)) : [];
  const addedUrls = new Set(servers.map((s) => (s.url || "").replace(/\/+$/, "")));
  const catalogList = showMcp
    ? MCP_CATALOG.filter(
        (i) =>
          !(i.url && addedUrls.has(i.url.replace(/\/+$/, ""))) &&
          matches(i.name, i.desc, i.category)
      )
    : [];

  const connectedCount = conns.filter((c) => c.connected).length;
  const totalShown = ampList.length + customList.length + catalogList.length;

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Org tools
            </div>
            <h2 style={{ marginBottom: 6 }}>Connect your stack</h2>
            <p style={{ fontSize: 14, color: "var(--fg-muted)", maxWidth: 520 }}>
              Wire up CRM, call recordings, notes and any MCP server. Every agent reasons over
              exactly what you connect here.
            </p>
          </div>
          <div
            className="badge badge-success"
            style={{ height: "fit-content", padding: "6px 12px" }}
          >
            <Icons.Check size={14} /> {connectedCount} of {connectors.length} connected
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div className="attach-search" style={{ flex: 1, minWidth: 220, margin: 0 }}>
            <Icons.Search size={16} style={{ color: "var(--fg-muted)" }} />
            <input
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connectors…"
              value={query}
            />
            {query && (
              <button
                className="icon-btn"
                onClick={() => setQuery("")}
                style={{ width: 26, height: 26 }}
              >
                <Icons.X size={15} />
              </button>
            )}
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setMcpEditing("new")}>
            <Icons.Plus size={15} /> Add MCP server
          </button>
        </div>

        <div
          className="scroll hide-scrollbar"
          style={{ overflowX: "auto", marginBottom: 20, paddingBottom: 2 }}
        >
          <div className="pilltabs">
            {CAT_TABS.map((t) => (
              <button
                className={"pilltab" + (tab === t ? " active" : "")}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="conn-grid">
          {ampList.map((c) => (
            <ConnectorCard
              c={c}
              key={c.id}
              onConnect={onConnect}
              onContact={onContact}
              onManage={onManage}
              sync={syncFor(c, sync)}
            />
          ))}
          {customList.map((s) => (
            <McpServerCard
              key={s.id}
              onEdit={setMcpEditing}
              onRemove={onMcpRemove}
              onToggle={onMcpToggle}
              s={s}
            />
          ))}
          {catalogList.map((i) => (
            <McpCatalogCard
              i={i}
              key={i.slug}
              onAdd={(item) => setMcpEditing({ name: item.name, url: item.url })}
              onConnect={onOauthConnect}
            />
          ))}
        </div>

        {totalShown === 0 && (
          <div style={{ textAlign: "center", color: "var(--fg-muted)", padding: "48px 16px" }}>
            <Icons.Search size={24} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14 }}>
              No connectors match “{query}”{tab === "All" ? "" : ` in ${tab}`}.
            </div>
          </div>
        )}
      </div>
      {connecting && (
        <ConnectModal
          amp={amp}
          connector={connecting.connector}
          mode={connecting.mode}
          onClose={() => {
            setConnecting(null);
            refetch();
          }}
          onToast={onToast}
        />
      )}
      {mcpEditing && (
        <McpServerModal
          onClose={() => setMcpEditing(null)}
          onSave={onMcpSave}
          server={mcpEditing === "new" ? null : mcpEditing}
        />
      )}
    </div>
  );
}
