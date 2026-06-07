// "Create your workspace" — captures identity and starts the free trial. This
// is intentionally NOT a login/password form: the template has no auth backend
// (the per-deploy MCP key is the only credential), so a password field would be
// theater. Real auth (Clerk/Auth0) is a deferred, separately-flagged concern.
import React, { useState } from "react";
import { Icons, LogoMark } from "./icons";
import { CONFIG } from "@/lib/gtm/config";

export function Signup({ initial, onFinish }) {
  const [f, setF] = useState(() => ({ name: initial?.name || "", email: initial?.email || "", company: initial?.company || "" }));
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const canSubmit = f.name.trim() && f.email.trim();
  const submit = () => { if (canSubmit) onFinish({ ...f, name: f.name.trim(), email: f.email.trim(), company: f.company.trim() }); };

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
          <div className="ob-brand"><LogoMark size={26} /><span>AmpUp</span></div>
          <div className="ob-aside-body">
            <div className="ob-aside-eyebrow">{billingOn ? `Free for ${trialDays} days` : "Get started"}</div>
            <h2 className="ob-aside-title">{billingOn ? `Spin up your GTM agent — free for ${trialDays} days.` : "Spin up your GTM agent workspace."}</h2>
            <div className="ob-steps" style={{ gap: 12 }}>
              {perks.map((p) => (
                <div key={p} className="ob-step done" style={{ cursor: "default" }}>
                  <span className="ob-step-dot"><Icons.Check size={13} /></span><span>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ob-aside-foot">
            <Icons.Spark size={14} /> {billingOn ? (cardRequired ? "Cancel anytime" : "No credit card required") : "Takes about a minute"}
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
              <label className="fld-wrap"><span className="fld-label">Full name</span>
                <input className="fld" autoFocus value={f.name} placeholder="Jane Rivera"
                  onChange={(e) => set("name", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></label>
              <label className="fld-wrap"><span className="fld-label">Work email</span>
                <input className="fld" type="email" value={f.email} placeholder="jane@company.com"
                  onChange={(e) => set("email", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></label>
              <label className="fld-wrap"><span className="fld-label">Company <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(optional)</span></span>
                <input className="fld" value={f.company} placeholder="Acme Inc."
                  onChange={(e) => set("company", e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /></label>
            </div>
          </div>
          <div className="ob-foot">
            <span />
            <button className="btn btn-primary btn-lg" disabled={!canSubmit} onClick={submit}>
              {billingOn ? "Create workspace & start trial" : "Create workspace"} <Icons.ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
