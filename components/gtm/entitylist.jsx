// EntityList — generic list page (table on desktop, cards on mobile)
import React, { useState, useEffect } from "react";
import { Icons } from "./icons";
import { EntityIcon, Avatar, TBadge, RefChip } from "./ui";
import { ENTITIES, COLUMNS, CONNECTORS, recordsOf, subtitleOf, byId } from "@/lib/gtm/data";

export function useIsMobile(bp = 720) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`);
    const fn = () => setM(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [bp]);
  return m;
}

function Cell({ rec, col, onOpen }) {
  const [key, , kind] = col;
  const v = rec[key];
  switch (kind) {
    case "title": return <div className="cell title">{v}</div>;
    case "badge": return <div className="cell">{v ? <TBadge value={v} /> : "—"}</div>;
    case "ref": { const r = byId(v); return <div className="cell">{r ? <RefChip record={r} onOpen={onOpen} /> : "—"}</div>; }
    case "avatar": { const r = byId(v); return <div className="cell">{r ? <><Avatar name={r.name} size={24} /><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span></> : "—"}</div>; }
    case "avatarTitle": return <div className="cell title"><Avatar name={rec.name} size={26} />{v}</div>;
    case "source": return <div className="cell">{(CONNECTORS.find((c) => c.id === v) || {}).name || v || "—"}</div>;
    case "min": return <div className="cell">{v ? `${v} min` : "—"}</div>;
    default: return <div className="cell">{v == null || v === "" ? "—" : String(v)}</div>;
  }
}

function MobileCard({ rec, onOpen }) {
  const badgeKey = rec.type === "deal" ? "stage" : rec.type === "task" ? "status" : rec.type === "account" ? "health" : null;
  return (
    <div className="card ecard card-hover" onClick={() => onOpen(rec)}>
      <EntityIcon type={rec.type} size={40} />
      <div className="meta">
        <div className="nm">{rec.name}</div>
        <div className="sb">{subtitleOf(rec)}</div>
      </div>
      {badgeKey && rec[badgeKey] && <TBadge value={rec[badgeKey]} />}
      <Icons.ChevronRight size={16} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
    </div>
  );
}

export function EntityList({ type, onOpen, onChat }) {
  const meta = ENTITIES[type];
  const cols = COLUMNS[type];
  const [q, setQ] = useState("");
  const isMobile = useIsMobile();
  const all = recordsOf(type);
  const rows = all.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || subtitleOf(r).toLowerCase().includes(q.toLowerCase()));
  const grid = `minmax(160px, 1.8fr) ${cols.slice(1).map(() => "1fr").join(" ")} 28px`;

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <EntityIcon type={type} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ marginBottom: 4 }}>{meta.plural}</h2>
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>{all.length} {meta.plural.toLowerCase()} · synced from your connected CRM</p>
          </div>
        </div>

        <div className="list-toolbar">
          <div className="search-box">
            <Icons.Search size={16} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
            <input placeholder={`Search ${meta.plural.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => onChat && onChat(null)}><Icons.Spark size={14} /> Chat with {meta.plural.toLowerCase()}</button>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
            <Icons.Inbox size={28} style={{ marginBottom: 10 }} />
            <div>{all.length === 0 ? `No ${meta.plural.toLowerCase()} synced yet.` : `No ${meta.plural.toLowerCase()} match “${q}”.`}</div>
          </div>
        ) : isMobile ? (
          <div className="ecard-list">{rows.map((r) => <MobileCard key={r.id} rec={r} onOpen={onOpen} />)}</div>
        ) : (
          <div className="etable">
            <div className="ehead" style={{ gridTemplateColumns: grid }}>
              {cols.map((c) => <div key={c[0]}>{c[1]}</div>)}<div />
            </div>
            {rows.map((r) => (
              <div key={r.id} className="erow" style={{ gridTemplateColumns: grid }} onClick={() => onOpen(r)}>
                {cols.map((c) => <Cell key={c[0]} rec={r} col={c} onOpen={onOpen} />)}
                <div className="chev"><Icons.ChevronRight size={16} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
