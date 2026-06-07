// Connectors gallery screen
import React, { useState, Suspense } from "react";
import { Icons } from "./icons";
import { ConnLogo } from "./ui";
import { CAT_TABS, getAmpersand } from "@/lib/gtm/data";

const AmpersandConnect = React.lazy(() => import("./AmpersandConnect"));

function ConnectorCard({ c, onConnect }) {
  const connected = c.connected;
  return (
    <div className={"card conn-card" + (connected ? " connected" : "")}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ConnLogo logo={c.logo} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-primary)" }}>{c.name}</div>
          <div className="badge" style={{ marginTop: 5, padding: "2px 8px", fontSize: 11 }}>{c.cat}</div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.5, flex: 1 }}>{c.desc}</div>
      <div>
        {connected ? (
          <span className="btn btn-sm" style={{ background: "var(--mint-glow-subtle)", color: "var(--fg-success)", border: "1px solid transparent", cursor: "default" }}>
            <Icons.CheckCircle size={15} /> Connected
          </span>
        ) : (
          <button className="btn btn-sm btn-outline" onClick={() => onConnect(c)}>
            <Icons.Plug size={14} /> Connect
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectModal({ connector, amp, onClose, onToast }) {
  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div className="card" style={{ width: "min(520px, 92vw)", maxHeight: "86vh", overflow: "auto", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <ConnLogo logo={connector.logo} size={32} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>Connect {connector.name}</div>
          <button className="icon-btn" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div style={{ padding: 16 }}>
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
  const [connecting, setConnecting] = useState(null);
  const amp = getAmpersand();
  const list = connectors.filter((c) => tab === "All" || c.cat === tab);
  const connectedCount = connectors.filter((c) => c.connected).length;
  const onConnect = (c) => {
    if (amp.configured && amp.apiKey) setConnecting(c);
    else onToast("Ampersand isn't configured for this org yet — set sales_agent.ampersand_project_id / ampersand_api_key.", "info");
  };

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="overline" style={{ marginBottom: 6 }}>Org tools</div>
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

        <div className="conn-grid">{list.map((c) => <ConnectorCard key={c.id} c={c} onConnect={onConnect} />)}</div>
      </div>
      {connecting && <ConnectModal connector={connecting} amp={amp} onClose={() => setConnecting(null)} onToast={onToast} />}
    </div>
  );
}
