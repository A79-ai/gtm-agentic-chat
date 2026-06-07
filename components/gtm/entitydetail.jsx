// EntityDetail — generic record detail + "Chat with this entity"
import React from "react";
import { Icons } from "./icons";
import { EntityIcon, TBadge, RefChip } from "./ui";
import { ENTITIES, FIELDS, CONNECTORS, byId, subtitleOf, related } from "@/lib/gtm/data";

function FieldVal({ rec, spec, onOpen }) {
  const [, key, kind] = spec;
  const v = rec[key];
  switch (kind) {
    case "badge": return v ? <TBadge value={v} /> : <span style={{ color: "var(--fg-muted)" }}>—</span>;
    case "ref": { const r = byId(v); return r ? <RefChip record={r} onOpen={onOpen} /> : <span style={{ color: "var(--fg-muted)" }}>—</span>; }
    case "min": return <span className="val">{v ? `${v} min` : "—"}</span>;
    default: return <span className="val">{v == null || v === "" ? "—" : String(v)}</span>;
  }
}

const REL_LABEL = { deal: "Deals", account: "Accounts", contact: "Contacts", meeting: "Meetings", task: "Tasks", owner: "Owner" };
const REL_ORDER = ["account", "owner", "contact", "deal", "meeting", "task"];

export function EntityDetail({ record, onOpen, onChat, onBack }) {
  const meta = ENTITIES[record.type];
  const fields = FIELDS[record.type] || [];
  const rel = related(record);

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad">
        <div className="detail-wrap">
          <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ marginBottom: 16, paddingLeft: 8 }}>
            <Icons.ArrowLeft size={15} /> {meta.plural}
          </button>

          <div className="detail-head">
            <EntityIcon type={record.type} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overline" style={{ marginBottom: 4 }}>{meta.label}</div>
              <h2 style={{ fontSize: 30, marginBottom: 6 }}>{record.name}</h2>
              <p style={{ fontSize: 14, color: "var(--fg-muted)" }}>{subtitleOf(record)}</p>
            </div>
            <button className="btn btn-primary" onClick={() => onChat(record)}>
              <Icons.Spark size={16} /> Chat with this {meta.label.toLowerCase()}
            </button>
          </div>

          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div className="detail-grid">
              {fields.map((f) => (
                <div className="field" key={f[1]}>
                  <div className="overline">{f[0]}</div>
                  <FieldVal rec={record} spec={f} onOpen={onOpen} />
                </div>
              ))}
            </div>
          </div>

          {record.type === "meeting" && record.summary && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <div className="overline" style={{ marginBottom: 8 }}>Summary</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-body)" }}>{record.summary}</p>
            </div>
          )}
          {record.type === "task" && record.note && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <div className="overline" style={{ marginBottom: 8 }}>Notes</div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-body)" }}>{record.note}</p>
            </div>
          )}

          {REL_ORDER.filter((k) => rel[k] && rel[k].length).map((k) => (
            <div className="card related-group" key={k} style={{ padding: 18, marginBottom: 14 }}>
              <div className="lbl">{REL_LABEL[k]} · {rel[k].length}</div>
              <div className="chip-wrap">{rel[k].map((r) => <RefChip key={r.id} record={r} onOpen={onOpen} />)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
