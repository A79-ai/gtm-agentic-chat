import { useState } from "react";
import { clearLlmKey, getLlmKey, LLM_PROVIDERS, setLlmKey } from "@/lib/gtm/llmKey";
import { roleBadgeStyle, roleMeta } from "@/lib/gtm/roles";
import { Icons } from "./icons";

function providerLabel(id) {
  return LLM_PROVIDERS.find((p) => p.id === id)?.label || id;
}

function ApiKeysPanel() {
  const saved = getLlmKey();
  const [provider, setProvider] = useState(saved?.provider || "anthropic");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(saved?.model || "");
  const [status, setStatus] = useState(
    saved ? `Using your ${providerLabel(saved.provider)} key for chat.` : ""
  );
  const meta = LLM_PROVIDERS.find((p) => p.id === provider) || LLM_PROVIDERS[0];

  const [testing, setTesting] = useState(false);

  const save = () => {
    if (!key.trim()) {
      setStatus("Enter a key first.");
      return;
    }
    setLlmKey({ provider, key: key.trim(), model: model.trim() });
    setKey("");
    setStatus(`Saved — chat now uses your ${meta.label} key.`);
  };
  const test = async () => {
    const k = key.trim() || saved?.key;
    if (!k) {
      setStatus("Enter a key first.");
      return;
    }
    setTesting(true);
    setStatus(`Testing your ${meta.label} key…`);
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: {
          "x-llm-provider": provider,
          "x-llm-key": k,
          ...(model.trim() ? { "x-llm-model": model.trim() } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      setStatus(
        res.ok && data.ok
          ? `✓ Your ${meta.label} key works${data.model ? ` (${data.model})` : ""}.`
          : `✗ Key didn't work: ${data.error || res.statusText}`
      );
    } catch {
      setStatus("✗ Couldn't reach the test endpoint. Check your connection.");
    } finally {
      setTesting(false);
    }
  };
  const clear = () => {
    clearLlmKey();
    setModel("");
    setStatus("Cleared. Chat falls back to the workspace key (internal & Pro only).");
  };

  const labelStyle = {
    fontSize: 11.5,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "var(--fg-muted)",
    marginBottom: 4,
    display: "block",
  };
  const inputStyle = {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 8,
    border: "1px solid var(--border-subtle)",
    background: "var(--bg-elevated)",
    color: "var(--fg-primary)",
    fontSize: 14,
  };

  return (
    <div className="card" style={{ padding: 22, marginTop: 18 }}>
      <h3 style={{ marginBottom: 4 }}>API keys</h3>
      <p style={{ fontSize: 13.5, color: "var(--fg-muted)", marginBottom: 16 }}>
        Bring your own LLM key for chat. It's stored only in this browser and sent directly with
        your requests — never saved on our servers. Internal &amp; Pro users can chat on the
        workspace key without one.
      </p>

      <div style={{ display: "grid", gap: 14, maxWidth: 440 }}>
        <div>
          <span style={labelStyle}>Provider</span>
          <select onChange={(e) => setProvider(e.target.value)} style={inputStyle} value={provider}>
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span style={labelStyle}>API key {saved ? "(a key is saved)" : ""}</span>
          <input
            onChange={(e) => setKey(e.target.value)}
            placeholder={saved ? "•••••••• — enter a new key to replace" : meta.placeholder}
            style={inputStyle}
            type="password"
            value={key}
          />
          <a
            href={meta.keysUrl}
            rel="noreferrer"
            style={{
              fontSize: 12.5,
              color: "var(--accent)",
              marginTop: 6,
              display: "inline-block",
            }}
            target="_blank"
          >
            Get a {meta.label} key →
          </a>
        </div>

        <div>
          <span style={labelStyle}>Model (optional)</span>
          <input
            onChange={(e) => setModel(e.target.value)}
            placeholder={meta.defaultModel}
            style={inputStyle}
            value={model}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={save} type="button">
            Save key
          </button>
          <button className="btn" disabled={testing} onClick={test} type="button">
            {testing ? "Testing…" : "Test key"}
          </button>
          <button className="btn" onClick={clear} type="button">
            Clear
          </button>
          {status ? (
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{status}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function initials(name) {
  return (
    (name || "You")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "U"
  );
}
function fmtDate(v) {
  if (!v) {
    return "-";
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Field({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11.5,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: "var(--fg-muted)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: "var(--fg-primary)", wordBreak: "break-word" }}>
        {value || "-"}
      </span>
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingBottom: 18,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {authUser?.picture ? (
            <img
              alt=""
              height={56}
              src={authUser.picture}
              style={{ borderRadius: "50%", objectFit: "cover" }}
              width={56}
            />
          ) : (
            <div className="avatar-lg" style={{ width: 56, height: 56, fontSize: 20 }}>
              {initials(name)}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 19, fontWeight: 600, color: "var(--fg-primary)" }}>
                {loading ? "…" : name}
              </span>
              {loading ? null : <span style={roleBadgeStyle(rm.tone)}>{rm.label}</span>}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 2 }}>{email}</div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 20,
            paddingTop: 18,
          }}
        >
          <Field label="Role" value={loading ? "…" : `${rm.label} · ${rm.scope}`} />
          <Field label="Workspace" value={me?.org_id} />
          <Field label="Title" value={me?.title} />
          <Field label="Region" value={me?.region} />
          <Field label="Member since" value={loading ? "…" : fmtDate(me?.first_login_at)} />
          <Field label="Sign-ins" value={loading ? "…" : String(me?.login_count ?? 0)} />
        </div>
      </div>

      <ApiKeysPanel />
    </div>
  );
}
