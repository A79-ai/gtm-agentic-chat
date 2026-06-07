// Home — launchpad: hero, connected sources, browse records, agents
import React, { useState } from "react";
import { Icons, LogoMark, Logos } from "./icons";
import { EntityIcon, TBadge, TONES } from "./ui";
import { ENTITY_ORDER, ENTITIES, recordsOf } from "@/lib/gtm/data";

function AgentTile({ agent, connectors, onOpen }) {
  const Icon = Icons[agent.icon] || Icons.Spark;
  const tone = TONES[agent.tone] || TONES.gold;
  const [hover, setHover] = useState(false);
  const tools = agent.tools.map((id) => connectors.find((c) => c.id === id)).filter(Boolean);
  return (
    <div className={"card" + (hover ? " card-hover" : "")} onClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "flex", flexDirection: "column", cursor: "pointer", overflow: "hidden" }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: tone.bg, color: tone.fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-primary)", lineHeight: 1.25 }}>{agent.name}</div>
            <div className="badge" style={{ marginTop: 6, padding: "2px 8px", fontSize: 11 }}>{agent.tag}</div>
          </div>
          {agent.starter && <TBadge value="Starter" tone="accent" />}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{agent.desc}</div>
      </div>
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex" }}>
            {tools.map((t, i) => (
              <div key={t.id} style={{ width: 22, height: 22, borderRadius: 6, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", padding: 3, marginLeft: i ? -6 : 0, zIndex: tools.length - i }}>
                {Logos[t.logo] && React.createElement(Logos[t.logo])}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>{tools.length} tools</span>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--fg-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Clock size={12} /> {agent.lastRun}</span>
      </div>
    </div>
  );
}

export function HomeScreen({ agents, connectors, openChat, openList, onNav }) {
  const [tab, setTab] = useState("All");
  const tabs = ["All", "Pipeline", "Calls", "Prospecting", "Research"];
  const list = agents.filter((a) => tab === "All" || a.tag === tab);
  const connected = connectors.filter((c) => c.connected);
  const firstOf = (t) => { const r = recordsOf(t); return r.length ? [r[0]] : []; };

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="card fade-up" style={{ padding: 28, marginBottom: 24, display: "flex", alignItems: "center", gap: 24, background: "linear-gradient(135deg, var(--accent-soft), var(--bg-card) 60%)", overflow: "hidden" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="overline" style={{ marginBottom: 8 }}>GTM Agent Workspace</div>
            <h2 style={{ fontSize: 32, marginBottom: 10 }}>Chat with your pipeline</h2>
            <p style={{ fontSize: 14.5, color: "var(--fg-body)", maxWidth: 520, marginBottom: 18 }}>Attach any deal, account, meeting or contact and let the agent reason over your connected CRM, calls and notes.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={() => openChat(firstOf("deal"))}><Icons.Spark size={16} /> Start a chat</button>
              <button className="btn btn-outline" onClick={() => openList("deal")}><Icons.Dollar size={15} /> Browse deals</button>
            </div>
          </div>
          <div className="hide-mobile" style={{ width: 120, height: 120, borderRadius: 24, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-primary)", flexShrink: 0, boxShadow: "var(--shadow-md)" }}><LogoMark size={58} /></div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)", fontWeight: 500 }}>Connected:</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
            {connected.map((c) => (
              <div key={c.id} className="badge" style={{ padding: "4px 10px 4px 5px", gap: 7 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, padding: 2, display: "inline-flex" }}>{React.createElement(Logos[c.logo])}</span>{c.name}
              </div>
            ))}
            <button className="badge" onClick={() => onNav("connectors")} style={{ cursor: "pointer", borderStyle: "dashed", color: "var(--fg-muted)" }}><Icons.Plus size={13} /> Add source</button>
          </div>
        </div>

        <h3 style={{ fontSize: 20, marginBottom: 14 }}>Browse records</h3>
        <div className="agent-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: 30 }}>
          {ENTITY_ORDER.map((t) => (
            <button key={t} className="card card-hover" onClick={() => openList(t)} style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", background: "var(--bg-card)" }}>
              <EntityIcon type={t} size={40} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>{ENTITIES[t].plural}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{recordsOf(t).length} records</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 20 }}>Your agents</h3>
          <div className="scroll hide-scrollbar" style={{ overflowX: "auto" }}>
            <div className="pilltabs">{tabs.map((t) => <button key={t} className={"pilltab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>)}</div>
          </div>
        </div>
        <div className="agent-grid">
          {list.map((a) => <AgentTile key={a.id} agent={a} connectors={connectors} onOpen={() => openChat(a.id === "call-digest" || a.id === "meeting-prep" ? firstOf("meeting") : a.id === "account-research" ? firstOf("account") : firstOf("deal"))} />)}
          <button className="card" onClick={() => onNav("connectors")} style={{ border: "1.5px dashed var(--border-default)", background: "transparent", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", color: "var(--fg-muted)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Plus size={22} /></div>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--fg-secondary)" }}>Create from scratch</div>
          </button>
        </div>
      </div>
    </div>
  );
}
