// AmpUp Notetaker settings
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/gtm/auth";
import { Icons } from "./icons";

const MODES = [
  { id: "disabled", label: "Off", desc: "The notetaker won't join any meetings." },
  {
    id: "record_all",
    label: "Record all",
    desc: "Join and record every meeting on your calendar.",
  },
  {
    id: "exclude_internal_meetings",
    label: "External only",
    desc: "Join customer meetings, skip internal ones.",
  },
  { id: "only_internal_meetings", label: "Internal only", desc: "Join internal meetings only." },
];

export function NotetakerScreen({ onToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState("disabled");
  const [name, setName] = useState("AmpUp Notetaker");
  const [testUrl, setTestUrl] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch("/api/notetaker")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setMode(d.mode);
          setName(d.name);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    const r = await apiFetch("/api/notetaker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, name }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false }));
    setSaving(false);
    onToast(
      r.ok ? "Notetaker settings saved" : "Couldn't save settings",
      r.ok ? "success" : "error"
    );
  };

  const sendTest = async () => {
    const url = testUrl.trim();
    if (!url) {
      return;
    }
    setTesting(true);
    const r = await apiFetch("/api/notetaker/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_url: url, bot_name: name }),
    })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Network error" }));
    setTesting(false);
    if (r.ok) {
      onToast("Notetaker is joining your meeting — give it a few seconds", "success");
      setTestUrl("");
    } else {
      onToast(r.error || "Couldn't send the notetaker", "error");
    }
  };

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "var(--teal-glow-subtle)",
              color: "var(--teal-deep)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icons.Calendar size={24} />
          </div>
          <div>
            <h2 style={{ marginBottom: 4 }}>AmpUp Notetaker</h2>
            <p style={{ fontSize: 13.5, color: "var(--fg-muted)" }}>
              An AI notetaker that joins your calls, transcribes them, and feeds the chat + briefs.
            </p>
          </div>
        </div>

        {loading ? (
          <div
            className="card"
            style={{ padding: 30, textAlign: "center", color: "var(--fg-muted)" }}
          >
            Loading settings…
          </div>
        ) : (
          <div
            className="card"
            style={{ padding: 22, display: "flex", flexDirection: "column", gap: 22 }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                When should it join?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    style={{
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: "var(--radius-lg)",
                      cursor: "pointer",
                      border:
                        mode === m.id
                          ? "1.5px solid var(--accent)"
                          : "1px solid var(--border-default)",
                      background: mode === m.id ? "var(--accent-soft)" : "var(--bg-surface)",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        flexShrink: 0,
                        border:
                          mode === m.id
                            ? "5px solid var(--accent)"
                            : "2px solid var(--border-default)",
                      }}
                    />
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--fg-primary)",
                        }}
                      >
                        {m.label}
                      </span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-muted)" }}>
                        {m.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                Notetaker name
              </div>
              <div className="search-box" style={{ maxWidth: "100%" }}>
                <Icons.User size={16} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                <input
                  onChange={(e) => setName(e.target.value)}
                  placeholder="AmpUp Notetaker"
                  value={name}
                />
              </div>
              <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 6 }}>
                The display name attendees see when the bot joins.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" disabled={saving} onClick={save}>
                <Icons.Check size={15} /> {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        )}

        {!loading && (
          <div
            className="card"
            style={{
              padding: 22,
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                Test the notetaker
              </div>
              <p style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>
                Paste a live meeting link and we'll send the notetaker to join it now, so you can
                see it work end-to-end.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
                <Icons.Calendar size={16} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
                <input
                  onChange={(e) => setTestUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !testing && testUrl.trim()) {
                      sendTest();
                    }
                  }}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={testUrl}
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={testing || !testUrl.trim()}
                onClick={sendTest}
              >
                <Icons.Send size={15} /> {testing ? "Sending…" : "Send notetaker"}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
              Works with Google Meet, Zoom and Teams links. The bot joins as “{name}”.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
