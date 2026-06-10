// EntityList — generic, Linear-style list page: dense selectable rows,
// multi-select (click / shift-range / select-all), a floating bulk-action bar,
// and customizable columns. One component drives every entity type via the
// COLUMNS config.
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icons } from "./icons";
import { EntityIcon, Avatar, TBadge, RefChip } from "./ui";
import { ENTITIES, COLUMNS, CONNECTORS, recordsOf, subtitleOf, byId } from "@/lib/gtm/data";
import { apiFetch } from "@/lib/gtm/auth";

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

// Per-type bulk actions, wired to MCP via /api/bulk. `pick` actions open a
// value menu first. (`chat`, rendered separately, attaches the selection to a
// new chat.) Contacts/owners have no MCP-supported bulk mutation.
const BULK_ACTIONS = {
  deal: [{ id: "stage", label: "Change stage", icon: "Trend", pick: "stage" }],
  account: [{ id: "owner", label: "Assign owner", icon: "Users", pick: "owner" }],
  meeting: [{ id: "sync", label: "Sync to CRM", icon: "Refresh" }],
  task: [
    { id: "complete", label: "Mark complete", icon: "CheckCircle" },
    { id: "priority", label: "Set priority", icon: "Activity", pick: "priority" },
  ],
};

function pickOptions(kind) {
  if (kind === "priority") return [["P0", "P0 — urgent"], ["P1", "P1 — high"], ["P2", "P2 — normal"]];
  if (kind === "stage") {
    const seen = [];
    recordsOf("deal").forEach((d) => { if (d.stage && !seen.includes(d.stage)) seen.push(d.stage); });
    return seen.map((s) => [s, s]);
  }
  if (kind === "owner") return recordsOf("owner").map((o) => [o.id, o.name]);
  return [];
}

function ValuePicker({ title, options, onPick, onClose }) {
  const ref = useDismiss(onClose);
  return (
    <div className="sel-picker" ref={ref}>
      <div className="sel-picker-head">{title}</div>
      <div className="sel-picker-list">
        {options.length === 0 ? <div className="sel-picker-empty">No options</div> :
          options.map(([v, l]) => <button key={v} className="sel-picker-item" onClick={() => onPick(v)}>{l}</button>)}
      </div>
    </div>
  );
}

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

// Per-type create forms. `entity` fields resolve an id via /api/search;
// `stage` reuses the deal-stage options. meeting/owner have no create tool.
const CREATE_FIELDS = {
  account: [
    { key: "name", label: "Account name", kind: "text", required: true, placeholder: "Acme Corp" },
    { key: "industry", label: "Industry", kind: "text", placeholder: "SaaS" },
  ],
  deal: [
    { key: "name", label: "Deal name", kind: "text", required: true, placeholder: "Acme — Platform expansion" },
    { key: "account_id", label: "Account", kind: "entity", searchType: "account", required: true },
    { key: "amount", label: "Amount ($)", kind: "number", required: true, placeholder: "50000" },
    { key: "close_date", label: "Close date", kind: "date", required: true },
    { key: "stage", label: "Stage", kind: "stage", required: true },
  ],
  contact: [
    { key: "first_name", label: "First name", kind: "text", placeholder: "Jane" },
    { key: "last_name", label: "Last name", kind: "text", placeholder: "Doe" },
    { key: "email", label: "Email", kind: "text", placeholder: "jane@acme.com" },
    { key: "title", label: "Title", kind: "text", placeholder: "VP Sales" },
    { key: "company", label: "Company", kind: "text", placeholder: "Acme Corp" },
  ],
  task: [
    { key: "parent_type", label: "Attach to", kind: "select", required: true, default: "opportunity",
      options: [["opportunity", "Deal"], ["account", "Account"], ["meeting", "Meeting"]] },
    { key: "parent_id", label: "Parent record", kind: "parent", required: true },
    { key: "subject", label: "Task", kind: "text", required: true, placeholder: "Send pricing follow-up" },
    { key: "priority", label: "Priority", kind: "select", default: "P1",
      options: [["P0", "P0 — urgent"], ["P1", "P1 — high"], ["P2", "P2 — normal"]] },
    { key: "due_date", label: "Due date", kind: "date" },
  ],
};
const PARENT_SEARCH = { opportunity: "deal", account: "account", meeting: "meeting" };

// Search-as-you-type picker that resolves a record id from the org's CRM.
function EntityPicker({ searchType, valueLabel, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(async () => {
      const query = q.trim();
      if (!query) { setItems([]); return; }
      const my = ++reqId.current;
      setLoading(true);
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json());
        if (my !== reqId.current) return;
        const g = (res.groups || []).find((x) => x.type === searchType);
        setItems(g ? g.items : []);
      } catch { if (my === reqId.current) setItems([]); }
      if (my === reqId.current) setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [q, open, searchType]);
  if (valueLabel) {
    return (
      <button type="button" className="create-picked" onClick={() => onPick(null)}>
        <span>{valueLabel}</span><Icons.X size={14} />
      </button>
    );
  }
  return (
    <div className="create-picker">
      <div className="search-box" style={{ height: 38 }}>
        <Icons.Search size={15} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
        <input placeholder={`Search ${searchType}s…`} value={q}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      </div>
      {open && q.trim() && (
        <div className="create-picker-list">
          {loading ? <div className="sel-picker-empty">Searching…</div>
            : items.length === 0 ? <div className="sel-picker-empty">No matches</div>
            : items.map((it) => (
              <button key={it.id} type="button" className="sel-picker-item" onClick={() => { onPick({ id: it.id, label: it.name }); setOpen(false); setQ(""); }}>
                {it.name}{it.subtitle ? <span style={{ color: "var(--fg-muted)" }}> · {it.subtitle}</span> : null}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function CreateModal({ type, onClose, onCreated, onToast }) {
  const meta = ENTITIES[type];
  const fields = CREATE_FIELDS[type] || [];
  const [vals, setVals] = useState(() => {
    const init = {};
    fields.forEach((f) => { if (f.default) init[f.key] = f.default; });
    return init;
  });
  const [labels, setLabels] = useState({}); // id -> human label for entity pickers
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));

  const stageOpts = pickOptions("stage");
  const nameOk = type !== "contact" || vals.first_name || vals.last_name || vals.email;
  const missing = fields.some((f) => f.required && !vals[f.key]) || !nameOk;

  const submit = async () => {
    if (missing || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fields: vals }),
      }).then((r) => r.json());
      if (res.ok) { onToast(`${meta.label} created`, "success"); onCreated && (await onCreated()); onClose(); }
      else onToast(`Couldn't create ${meta.label.toLowerCase()}: ${res.error || "error"}`, "error");
    } catch {
      onToast(`Couldn't create ${meta.label.toLowerCase()}`, "error");
    }
    setBusy(false);
  };

  const renderField = (f) => {
    if (f.kind === "select") {
      return <select className="create-input" value={vals[f.key] || ""} onChange={(e) => { set(f.key, e.target.value); if (f.key === "parent_type") { set("parent_id", ""); setLabels((l) => ({ ...l, parent_id: "" })); } }}>
        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>;
    }
    if (f.kind === "stage") {
      if (stageOpts.length) return <select className="create-input" value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
        <option value="">Select a stage…</option>
        {stageOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>;
      return <input className="create-input" placeholder="Discovery" value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />;
    }
    if (f.kind === "entity" || f.kind === "parent") {
      const searchType = f.kind === "parent" ? PARENT_SEARCH[vals.parent_type || "opportunity"] : f.searchType;
      return <EntityPicker searchType={searchType} valueLabel={labels[f.key]}
        onPick={(p) => { set(f.key, p ? p.id : ""); setLabels((l) => ({ ...l, [f.key]: p ? p.label : "" })); }} />;
    }
    return <input className="create-input" type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
      placeholder={f.placeholder || ""} value={vals[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />;
  };

  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center", zIndex: 95 }} onClick={onClose}>
      <div className="card" style={{ width: "min(460px, 92vw)", maxHeight: "88vh", overflow: "auto", padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <EntityIcon type={type} size={30} />
          <div style={{ flex: 1, fontWeight: 600, color: "var(--fg-primary)" }}>New {meta.label.toLowerCase()}</div>
          <button className="icon-btn" onClick={onClose}><Icons.X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label className="create-label">{f.label}{f.required && <span style={{ color: "var(--accent)" }}> *</span>}</label>
              {renderField(f)}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button className="btn btn-sm btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={submit} disabled={missing || busy}>
              {busy ? <><Icons.Refresh size={14} className="spin" /> Creating…</> : <><Icons.Plus size={14} /> Create {meta.label.toLowerCase()}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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

function SelectionBar({ count, label, plural, actions, pending, onAction, onChat, onClear }) {
  const noun = (count === 1 ? label : plural).toLowerCase();
  return (
    <div className="sel-bar">
      <button className="sel-clear" onClick={onClear} title="Clear selection"><Icons.X size={15} /></button>
      <span className="sel-count">{pending ? "Working…" : `${count} selected`}</span>
      <div className="sel-divider" />
      <button className="sel-act primary" disabled={pending} onClick={onChat}><Icons.Spark size={14} /> Chat with {count} {noun}</button>
      {actions.map((a) => (
        <button key={a.id} className="sel-act" disabled={pending} onClick={() => onAction(a)}>
          {React.createElement(Icons[a.icon] || Icons.Activity, { size: 14 })} {a.label}
        </button>
      ))}
    </div>
  );
}

export function EntityList({ type, onOpen, onChat, onToast, onRefresh }) {
  const meta = ENTITIES[type];
  const cols = COLUMNS[type];
  const isOwner = type === "owner"; // no list tool — derive from the loaded store
  const SIZE = 50;

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(!isOwner);
  const [sel, setSel] = useState(() => new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const [picker, setPicker] = useState(null); // { action, options }
  const [pending, setPending] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!CREATE_FIELDS[type];
  const [visible, setVisible] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("ampup-cols-" + type)); if (Array.isArray(s)) return new Set([cols[0][0], ...s]); } catch {}
    return new Set(cols.map((c) => c[0]));
  });
  const lastIdx = useRef(null);
  const reqId = useRef(0);
  const isMobile = useIsMobile();

  // debounce the search box into a server query; reset to first page
  useEffect(() => { const id = setTimeout(() => { setSearch(q.trim()); setPage(0); }, 300); return () => clearTimeout(id); }, [q]);

  const fetchPage = useCallback(async () => {
    if (isOwner) return;
    const my = ++reqId.current;
    setLoading(true);
    try {
      const url = `/api/list?type=${type}&page=${page}&size=${SIZE}` + (search ? `&search=${encodeURIComponent(search)}` : "");
      // apiFetch injects the per-user x-ampup-mcp-key; a bare fetch() 401s in
      // multi-tenant mode (the list endpoint requires the key), which silently
      // emptied every records list ("No meetings synced yet" despite a non-zero
      // badge count, which loads via apiFetch).
      const res = await apiFetch(url).then((r) => r.json());
      if (my !== reqId.current) return; // a newer request superseded this one
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(typeof res.total === "number" ? res.total : null);
    } catch {
      if (my === reqId.current) { setItems([]); setTotal(null); }
    }
    if (my === reqId.current) setLoading(false);
  }, [type, page, search, isOwner]);

  useEffect(() => { fetchPage(); }, [fetchPage]);
  useEffect(() => { setSel(new Set()); lastIdx.current = null; }, [page, search]);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") setSel(new Set()); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const ownerRows = isOwner ? recordsOf("owner").filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || subtitleOf(r).toLowerCase().includes(search.toLowerCase())) : [];
  const rows = isOwner ? ownerRows : items;
  const totalCount = isOwner ? ownerRows.length : total;

  const shownCols = cols.filter((c) => visible.has(c[0]));
  const grid = `30px minmax(160px, 1.8fr) ${shownCols.slice(1).map(() => "1fr").join(" ")} 28px`;

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

  const runBulk = async (action, value) => {
    setPending(true);
    setPicker(null);
    const ids = [...sel];
    try {
      const res = await apiFetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, action: action.id, ids, value }),
      }).then((r) => r.json());
      if (res.ok) onToast && onToast(`${action.label} — ${res.done} ${meta.plural.toLowerCase()} updated`, "success");
      else onToast && onToast(`${action.label}: ${res.done || 0}/${res.total || ids.length} updated`, res.done ? "info" : "error");
      onRefresh && (await onRefresh());
      await fetchPage();
      setSel(new Set());
    } catch {
      onToast && onToast(`${action.label} failed`, "error");
    }
    setPending(false);
  };
  const bulkAction = (a) => { if (a.pick) setPicker({ action: a, options: pickOptions(a.pick) }); else runBulk(a); };

  // pagination math (server pages; owner is single-page client-side)
  const from = page * SIZE;
  const canPrev = page > 0;
  const canNext = !isOwner && (totalCount != null ? from + SIZE < totalCount : items.length === SIZE);
  const showPager = !isOwner && (canPrev || canNext);
  const countLabel = totalCount != null ? `${totalCount}` : `${rows.length}+`;

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <EntityIcon type={type} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ marginBottom: 4 }}>{meta.plural}</h2>
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>{countLabel} {meta.plural.toLowerCase()} · synced from your connected CRM</p>
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
          {canCreate && <button className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)}><Icons.Plus size={14} /> New {meta.label.toLowerCase()}</button>}
        </div>

        {loading && rows.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
            <span className="spin" style={{ display: "inline-flex", marginBottom: 10 }}><Icons.Refresh size={20} /></span>
            <div>Loading {meta.plural.toLowerCase()}…</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
            <Icons.Inbox size={28} style={{ marginBottom: 10 }} />
            <div>{search ? `No ${meta.plural.toLowerCase()} match “${search}”.` : `No ${meta.plural.toLowerCase()} synced yet.`}</div>
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

        {showPager && (
          <div className="list-pager">
            <span className="list-pager-info">{rows.length ? `${from + 1}–${from + rows.length}` : "0"}{totalCount != null ? ` of ${totalCount}` : ""}</span>
            <div className="list-pager-btns">
              <button className="btn btn-sm btn-outline" disabled={!canPrev || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}><Icons.ArrowLeft size={14} /> Prev</button>
              <button className="btn btn-sm btn-outline" disabled={!canNext || loading} onClick={() => setPage((p) => p + 1)}>Next <Icons.ArrowRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {selCount > 0 && (
        <SelectionBar count={selCount} label={meta.label} plural={meta.plural} actions={BULK_ACTIONS[type] || []} pending={pending} onAction={bulkAction} onChat={bulkChat} onClear={() => { setSel(new Set()); setPicker(null); }} />
      )}
      {picker && (
        <ValuePicker title={picker.action.label} options={picker.options} onPick={(v) => runBulk(picker.action, v)} onClose={() => setPicker(null)} />
      )}
      {createOpen && (
        <CreateModal type={type} onClose={() => setCreateOpen(false)} onToast={onToast}
          onCreated={async () => { onRefresh && (await onRefresh()); setPage(0); await fetchPage(); }} />
      )}
    </div>
  );
}
