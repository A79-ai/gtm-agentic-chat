// Profile page — the signed-in user's identity, role, and workspace info.
// Data comes from /api/me (AmpUp /api/v1/user/me). The role badge makes the
// super-admin / admin / member distinction visible (admins see all org data).
import React from "react";
import { Icons } from "./icons";
import { roleMeta, roleBadgeStyle } from "@/lib/gtm/roles";

function initials(name) {
  return (
    (name || "You").trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "U"
  );
}
function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--fg-muted)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--fg-primary)", wordBreak: "break-word" }}>{value || "—"}</span>
    </div>
  );
}

export function ProfileScreen({ me, authUser }) {
  const loading = !me;
  const name = me?.name || authUser?.name || authUser?.email || "You";
  const email = me?.email || authUser?.email || "";
  const rm = roleMeta(me?.role);

  return (
    <div className="screen-pad" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
        <Icons.User size={46} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginBottom: 4 }}>Profile</h2>
          <p style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>Your account and workspace</p>
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 18, borderBottom: "1px solid var(--border-subtle)" }}>
          {authUser?.picture ? (
            <img src={authUser.picture} alt="" width={56} height={56} style={{ borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div className="avatar-lg" style={{ width: 56, height: 56, fontSize: 20 }}>{initials(name)}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 19, fontWeight: 600, color: "var(--fg-primary)" }}>{loading ? "…" : name}</span>
              {!loading ? <span style={roleBadgeStyle(rm.tone)}>{rm.label}</span> : null}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 2 }}>{email}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, paddingTop: 18 }}>
          <Field label="Role" value={loading ? "…" : `${rm.label} · ${rm.scope}`} />
          <Field label="Workspace" value={me?.org_id} />
          <Field label="Title" value={me?.title} />
          <Field label="Region" value={me?.region} />
          <Field label="Member since" value={loading ? "…" : fmtDate(me?.first_login_at)} />
          <Field label="Sign-ins" value={loading ? "…" : String(me?.login_count ?? 0)} />
        </div>
      </div>
    </div>
  );
}
