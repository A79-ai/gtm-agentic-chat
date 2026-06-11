// EntityDetail: generic record detail + "Chat with this entity"
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/gtm/auth";
import { byId, ENTITIES, FIELDS, related, subtitleOf } from "@/lib/gtm/data";
import { Icons } from "./icons";
import { EntityIcon, RefChip, TBadge } from "./ui";

function FieldVal({ rec, spec, onOpen }) {
  const [, key, kind] = spec;
  const v = rec[key];
  switch (kind) {
    case "badge":
      return v ? <TBadge value={v} /> : <span style={{ color: "var(--fg-muted)" }}>-</span>;
    case "ref": {
      const r = byId(v);
      return r ? (
        <RefChip onOpen={onOpen} record={r} />
      ) : (
        <span style={{ color: "var(--fg-muted)" }}>-</span>
      );
    }
    case "min":
      return <span className="val">{v ? `${v} min` : "-"}</span>;
    default:
      return <span className="val">{v == null || v === "" ? "-" : String(v)}</span>;
  }
}

function Bullets({ items }) {
  if (!items?.length) {
    return null;
  }
  return (
    <ul
      style={{
        margin: "6px 0 0",
        paddingLeft: 18,
        fontSize: 13,
        color: "var(--fg-body)",
        lineHeight: 1.5,
      }}
    >
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function MeetingBriefs({ meetingId }) {
  const [pre, setPre] = useState(undefined);
  const [post, setPost] = useState(undefined);
  useEffect(() => {
    let alive = true;
    apiFetch(`/api/meeting-brief?type=pre&id=${encodeURIComponent(meetingId)}`)
      .then((r) => r.json())
      .then((d) => alive && setPre(d))
      .catch(() => alive && setPre({ empty: true }));
    apiFetch(`/api/meeting-brief?type=post&id=${encodeURIComponent(meetingId)}`)
      .then((r) => r.json())
      .then((d) => alive && setPost(d))
      .catch(() => alive && setPost({ empty: true }));
    return () => {
      alive = false;
    };
  }, [meetingId]);

  const Field = ({ label, value }) =>
    value ? (
      <div style={{ marginTop: 8 }}>
        <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--fg-primary)" }}>{value}</div>
      </div>
    ) : null;
  const List = ({ label, items }) =>
    items?.length ? (
      <div style={{ marginTop: 8 }}>
        <div className="eyebrow" style={{ fontSize: 10 }}>
          {label}
        </div>
        <Bullets items={items} />
      </div>
    ) : null;

  return (
    <>
      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Icons.FileText size={16} style={{ color: "var(--fg-emphasis)" }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>
            Pre-meeting brief
          </span>
        </div>
        {pre === undefined ? (
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Loading…</p>
        ) : pre.empty ? (
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>No pre-meeting brief yet.</p>
        ) : (
          <>
            <Field label="Stage" value={pre.stage} />
            <Field label="Next milestone" value={pre.nextMilestone} />
            <List items={pre.confirmedNeeds} label="Confirmed needs" />
            <List items={pre.outstandingQuestions} label="Outstanding questions" />
            <List items={pre.risks} label="Risks & blockers" />
          </>
        )}
      </div>
      <div className="card" style={{ padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Icons.CheckCircle size={16} style={{ color: "var(--fg-success)" }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--fg-primary)" }}>
            Post-meeting brief
          </span>
        </div>
        {post === undefined ? (
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>Loading…</p>
        ) : post.empty ? (
          <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>No post-meeting brief yet.</p>
        ) : (
          <>
            <Field label="Result" value={post.result} />
            <Field label="Summary" value={post.summary} />
            <Field label="Outcome" value={post.outcome} />
            <List items={post.keyPoints} label="Key discussion points" />
            <Field label="Follow-up email" value={post.emailSubject} />
          </>
        )}
      </div>
    </>
  );
}

const REL_LABEL = {
  deal: "Deals",
  account: "Accounts",
  contact: "Contacts",
  meeting: "Meetings",
  task: "Tasks",
  owner: "Owner",
};
const REL_ORDER = ["account", "owner", "contact", "deal", "meeting", "task"];

export function EntityDetail({ record, onOpen, onChat, onBack }) {
  const meta = ENTITIES[record.type];
  const fields = FIELDS[record.type] || [];
  const rel = related(record);

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad">
        <div className="detail-wrap">
          <button
            className="btn btn-sm btn-ghost"
            onClick={onBack}
            style={{ marginBottom: 16, paddingLeft: 8 }}
          >
            <Icons.ArrowLeft size={15} /> {meta.plural}
          </button>

          <div className="detail-head">
            <EntityIcon size={56} type={record.type} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                {meta.label}
              </div>
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
                  <div className="eyebrow">{f[0]}</div>
                  <FieldVal onOpen={onOpen} rec={record} spec={f} />
                </div>
              ))}
            </div>
          </div>

          {record.type === "meeting" && record.summary && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Summary
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-body)" }}>
                {record.summary}
              </p>
            </div>
          )}
          {record.type === "meeting" && <MeetingBriefs meetingId={record.id} />}
          {record.type === "task" && record.note && (
            <div className="card" style={{ padding: 22, marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Notes
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-body)" }}>
                {record.note}
              </p>
            </div>
          )}

          {REL_ORDER.filter((k) => rel[k] && rel[k].length).map((k) => (
            <div className="card related-group" key={k} style={{ padding: 18, marginBottom: 14 }}>
              <div className="lbl">
                {REL_LABEL[k]} · {rel[k].length}
              </div>
              <div className="chip-wrap">
                {rel[k].map((r) => (
                  <RefChip key={r.id} onOpen={onOpen} record={r} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
