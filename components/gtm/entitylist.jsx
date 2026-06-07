// EntityList — generic, Linear-style list page: dense selectable rows,
// multi-select (click / shift-range / select-all), a floating bulk-action bar,
// and customizable columns. One component drives every entity type via the
// COLUMNS config.
import React, { useState, useEffect, useRef } from "react";
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

// Per-type bulk actions. `chat` (rendered separately) is real — it opens chat
// with the selected records; these type-specific actions surface intent via a
// toast until the MCP write routes are wired.
const BULK_ACTIONS = {
  deal: [{ id: "stage", label: "Change stage", icon: "Trend" }],
  account: [{ id: "owner", label: "Assign owner", icon: "Users" }],
  contact: [{ id: "owner", label: "Assign owner", icon: "Users" }],
  meeting: [{ id: "sync", label: "Sync to CRM", icon: "Refresh" }],
  task: [{ id: "complete", label: "Mark complete", icon: "CheckCircle" }, { id: "priority", label: "Set priority", icon: "Activity" }],
  owner: [],
};

function useDismiss(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, []);
  return ref;
}

function Check({ on, indeterminate }) {
  return (
    <span className={"row-check" + (on ? " on" : "") + (indeterminate ? " mixed" : "")}>
      {on ? <Icons.Check size={12} /> : indeterminate ? <span className="dash" /> : null}
    </span>
  );
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

function ColumnsMenu({ cols, visible, onToggle, onClose }) {
  const ref = useDismiss(onClose);
  return (
    <div className="cols-menu" ref={ref}>
      <div className="cols-menu-head">Columns</div>
      {cols.map((c, i) => {
        const locked = i === 0; // title column always shown
        return (
          <button key={c[0]} className="cols-menu-item" disabled={locked} onClick={() => !locked && onToggle(c[0])}>
            <Check on={visible.has(c[0])} />
            <span className="cols-menu-label">{c[1]}</span>
            {locked && <span className="cols-menu-lock">Always</span>}
          </button>
        );
      })}
    </div>
  );
}

function MobileCard({ rec, selected, selecting, onToggle, onOpen }) {
  const badgeKey = rec.type === "deal" ? "stage" : rec.type === "task" ? "status" : rec.type === "account" ? "health" : null;
  return (
    <div className={"card ecard card-hover" + (selected ? " selected" : "")} onClick={() => (selecting ? onToggle() : onOpen(rec))}>
      <button className="ecard-check" onClick={(e) => { e.stopPropagation(); onToggle(); }}><Check on={selected} /></button>
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

function SelectionBar({ count, plural, actions, onAction, onChat, onClear }) {
  return (
    <div className="sel-bar">
      <button className="sel-clear" onClick={onClear} title="Clear selection"><Icons.X size={15} /></button>
      <span className="sel-count">{count} selected</span>
      <div className="sel-divider" />
      <button className="sel-act primary" onClick={onChat}><Icons.Spark size={14} /> Chat with {count} {plural.toLowerCase()}</button>
      {actions.map((a) => (
        <button key={a.id} className="sel-act" onClick={() => onAction(a)}>
          {React.createElement(Icons[a.icon] || Icons.Activity, { size: 14 })} {a.label}
        </button>
      ))}
    </div>
  );
}

export function EntityList({ type, onOpen, onChat, onToast }) {
  const meta = ENTITIES[type];
  const cols = COLUMNS[type];
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const [visible, setVisible] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("ampup-cols-" + type)); if (Array.isArray(s)) return new Set([cols[0][0], ...s]); } catch {}
    return new Set(cols.map((c) => c[0]));
  });
  const lastIdx = useRef(null);
  const isMobile = useIsMobile();
  const all = recordsOf(type);
  const rows = all.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || subtitleOf(r).toLowerCase().includes(q.toLowerCase()));

  const shownCols = cols.filter((c) => visible.has(c[0]));
  const grid = `30px minmax(160px, 1.8fr) ${shownCols.slice(1).map(() => "1fr").join(" ")} 28px`;

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") setSel(new Set()); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const toggleCol = (key) => setVisible((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    next.add(cols[0][0]); // title always visible
    try { localStorage.setItem("ampup-cols-" + type, JSON.stringify([...next])); } catch {}
    return next;
  });

  const selCount = sel.size;
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const someOn = selCount > 0 && !allOn;
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleRow = (idx, id, shift) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (shift && lastIdx.current != null) {
        const [a, b] = [lastIdx.current, idx].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) next.add(rows[i].id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastIdx.current = idx;
  };

  const selectedRecords = rows.filter((r) => sel.has(r.id));
  const bulkChat = () => { onChat && onChat(selectedRecords); };
  const bulkAction = (a) => { onToast && onToast(`${a.label} — ${selCount} ${meta.plural.toLowerCase()} (coming soon)`, "info"); };

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
          {!isMobile && (
            <div style={{ position: "relative" }}>
              <button className="btn btn-sm btn-outline" onClick={() => setColsOpen((v) => !v)}><Icons.Sliders size={14} /> Columns</button>
              {colsOpen && <ColumnsMenu cols={cols} visible={visible} onToggle={toggleCol} onClose={() => setColsOpen(false)} />}
            </div>
          )}
          <button className="btn btn-sm btn-outline" onClick={() => onChat && onChat([])}><Icons.Spark size={14} /> Chat with {meta.plural.toLowerCase()}</button>
        </div>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
            <Icons.Inbox size={28} style={{ marginBottom: 10 }} />
            <div>{all.length === 0 ? `No ${meta.plural.toLowerCase()} synced yet.` : `No ${meta.plural.toLowerCase()} match “${q}”.`}</div>
          </div>
        ) : isMobile ? (
          <div className="ecard-list">{rows.map((r, i) => <MobileCard key={r.id} rec={r} selected={sel.has(r.id)} selecting={selCount > 0} onToggle={() => toggleRow(i, r.id, false)} onOpen={onOpen} />)}</div>
        ) : (
          <div className={"etable" + (selCount > 0 ? " selecting" : "")}>
            <div className="ehead" style={{ gridTemplateColumns: grid }}>
              <button className="row-checkbtn" onClick={toggleAll} title={allOn ? "Deselect all" : "Select all"}><Check on={allOn} indeterminate={someOn} /></button>
              {shownCols.map((c) => <div key={c[0]}>{c[1]}</div>)}<div />
            </div>
            {rows.map((r, i) => {
              const on = sel.has(r.id);
              return (
                <div key={r.id} className={"erow" + (on ? " selected" : "")} style={{ gridTemplateColumns: grid }} onClick={() => onOpen(r)}>
                  <button className="row-checkbtn" onClick={(e) => { e.stopPropagation(); toggleRow(i, r.id, e.shiftKey); }} title="Select"><Check on={on} /></button>
                  {shownCols.map((c) => <Cell key={c[0]} rec={r} col={c} onOpen={onOpen} />)}
                  <div className="chev"><Icons.ChevronRight size={16} /></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selCount > 0 && (
        <SelectionBar count={selCount} plural={meta.plural} actions={BULK_ACTIONS[type] || []} onAction={bulkAction} onChat={bulkChat} onClear={() => setSel(new Set())} />
      )}
    </div>
  );
}
