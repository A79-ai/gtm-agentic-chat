// "Create your workspace": captures identity and starts the free trial. This
// is intentionally NOT a login/password form: the template has no auth backend
// (the per-deploy MCP key is the only credential), so a password field would be
// theater. Real auth (Clerk/Auth0) is a deferred, separately-flagged concern.
import React, { useEffect, useState } from "react";
import { CONFIG } from "@/lib/gtm/config";
import { Icons, LogoMark, Logos } from "./icons";

export function Signup({ initial, onFinish }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || "",
    email: initial?.email || "",
    company: initial?.company || "",
  }));
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(!!d.googleEnabled))
      .catch(() => {});
  }, []);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const canSubmit = f.name.trim() && f.email.trim();
  const submit = () => {
    if (canSubmit) {
      onFinish({ ...f, name: f.name.trim(), email: f.email.trim(), company: f.company.trim() });
    }
  };

  const { enabled: billingOn, trialDays, cardRequired } = CONFIG.billing;
  const perks = [
    "Agentic chat grounded in your real CRM",
    "Connect HubSpot, Gong, Fireflies + more",
    "Notetaker, meeting briefs & deal tasks",
  ];

  return (
    <div className="flow-overlay">
      <div className="ob-shell">
        <div className="ob-aside">
          <div className="ob-brand">
            <LogoMark size={26} />
            <span>AmpUp</span>
          </div>
          <div className="ob-aside-body">
            <div className="ob-aside-eyebrow">
              {billingOn ? `Free for ${trialDays} days` : "Get started"}
            </div>
            <h2 className="ob-aside-title">
              {billingOn
                ? `Spin up your GTM agent, free for ${trialDays} days.`
                : "Spin up your GTM agent workspace."}
            </h2>
            <div className="ob-steps" style={{ gap: 12 }}>
              {perks.map((p) => (
                <div className="ob-step done" key={p} style={{ cursor: "default" }}>
                  <span className="ob-step-dot">
                    <Icons.Check size={13} />
                  </span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <a
              className="ob-gh-star"
              href={CONFIG.repoUrl}
              rel="noopener noreferrer"
              target="_blank"
              title="Open source. Run it yourself on Vercel"
            >
              <Icons.Github size={16} />
              <span>Open source. Star it on GitHub</span>
              <Icons.Star size={13} style={{ marginLeft: "auto", opacity: 0.85 }} />
            </a>
          </div>
          <div className="ob-aside-foot">
            <Icons.Spark size={14} />{" "}
            {billingOn
              ? cardRequired
                ? "Cancel anytime"
                : "No credit card required"
              : "Takes about a minute"}
          </div>
        </div>
        <div className="ob-main">
          <div className="ob-main-head">
            <div>
              <div className="ob-eyebrow">Create your workspace</div>
              <h1 className="ob-h1">Let’s get you set up</h1>
            </div>
          </div>
          <div className="ob-scroll">
            <div className="ob-form">
              {googleEnabled && (
                <>
                  <button
                    className="btn btn-lg"
                    onClick={() => {
                      window.location.href = "/api/auth/google/start";
                    }}
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      gap: 10,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      color: "var(--fg-primary)",
                    }}
                  >
                    <span style={{ width: 18, height: 18, display: "inline-flex" }}>
                      {Logos.Google ? React.createElement(Logos.Google) : <Icons.Mail size={16} />}
                    </span>
                    Continue with Google
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                    <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>or</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
                  </div>
                </>
              )}
              <label className="fld-wrap">
                <span className="fld-label">Full name</span>
                <input
                  autoFocus
                  className="fld"
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      submit();
                    }
                  }}
                  placeholder="Jane Rivera"
                  value={f.name}
                />
              </label>
              <label className="fld-wrap">
                <span className="fld-label">Work email</span>
                <input
                  className="fld"
                  onChange={(e) => set("email", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      submit();
                    }
                  }}
                  placeholder="jane@company.com"
                  type="email"
                  value={f.email}
                />
              </label>
              <label className="fld-wrap">
                <span className="fld-label">
                  Company{" "}
                  <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optional)</span>
                </span>
                <input
                  className="fld"
                  onChange={(e) => set("company", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      submit();
                    }
                  }}
                  placeholder="Acme Inc."
                  value={f.company}
                />
              </label>
            </div>
          </div>
          <div className="ob-foot">
            <span />
            <button className="btn btn-primary btn-lg" disabled={!canSubmit} onClick={submit}>
              {billingOn ? "Create workspace & start trial" : "Create workspace"}{" "}
              <Icons.ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
