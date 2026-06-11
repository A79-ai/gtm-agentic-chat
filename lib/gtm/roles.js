// Map a backend UserRole (super_admin | admin | user) to a display label and a
// tone used by the role badge in the profile menu + profile page. Super-admins
// and admins see org-wide data (FGA bypass), so the badge doubles as a "why am I
// seeing everyone's records" cue.
export function roleMeta(role) {
  const r = (role || "").toLowerCase();
  if (r === "super_admin") {
    return { label: "Super Admin", tone: "gold", scope: "Sees all data in this workspace" };
  }
  if (r === "admin") {
    return { label: "Admin", tone: "blue", scope: "Sees all data in this workspace" };
  }
  return { label: "Member", tone: "muted", scope: "Sees only their own records" };
}

// Inline style for a role pill, keyed by tone. Kept here so the menu and the
// profile page render an identical badge.
export function roleBadgeStyle(tone) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid",
  };
  if (tone === "gold") {
    return {
      ...base,
      color: "var(--accent, #D2A232)",
      borderColor: "color-mix(in srgb, var(--accent, #D2A232) 45%, transparent)",
      background: "color-mix(in srgb, var(--accent, #D2A232) 14%, transparent)",
    };
  }
  if (tone === "blue") {
    return {
      ...base,
      color: "#5b9bd5",
      borderColor: "color-mix(in srgb, #5b9bd5 45%, transparent)",
      background: "color-mix(in srgb, #5b9bd5 14%, transparent)",
    };
  }
  return {
    ...base,
    color: "var(--fg-muted)",
    borderColor: "var(--border-subtle)",
    background: "transparent",
  };
}
