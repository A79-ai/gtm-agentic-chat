// Connectors gallery screen
import React, { useState } from "react";
import { Icons } from "./icons";
import { ConnLogo } from "./ui";
import { CAT_TABS } from "@/lib/gtm/data";

function ConnectorCard({ c, onToggle }) {
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
          <button className="btn btn-sm" onClick={() => onToggle(c.id)} style={{ background: "var(--mint-glow-subtle)", color: "var(--fg-success)", border: "1px solid transparent" }}>
            <Icons.CheckCircle size={15} /> Connected
          </button>
        ) : (
          <button className="btn btn-sm btn-outline" onClick={() => onToggle(c.id)}>
            <Icons.Plug size={14} /> Connect
          </button>
        )}
      </div>
    </div>
  );
}

export function ConnectorsScreen({ connectors, onToggle, onToast }) {
  const [tab, setTab] = useState("All");
  const list = connectors.filter((c) => tab === "All" || c.cat === tab);
  const connectedCount = connectors.filter((c) => c.connected).length;
  const toggle = (id) => {
    const c = connectors.find((x) => x.id === id);
    onToggle(id);
    onToast(c.connected ? `${c.name} disconnected` : `${c.name} connected`, c.connected ? "info" : "success");
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

        <div className="conn-grid">{list.map((c) => <ConnectorCard key={c.id} c={c} onToggle={toggle} />)}</div>
      </div>
    </div>
  );
}
