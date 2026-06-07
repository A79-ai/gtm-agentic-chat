// First-run onboarding wizard — collect details, pick focus, and connect
// Google Calendar via the real Ampersand widget. Full-screen overlay shown on
// first run (and re-openable from the profile menu).
import React, { useState, Suspense } from "react";
import { Icons, LogoMark, Logos } from "./icons";
import { getAmpersand, getConnectors } from "@/lib/gtm/data";

const AmpersandConnect = React.lazy(() => import("./AmpersandConnect"));

const ROLES = ["Account Executive", "SDR / BDR", "RevOps", "Sales Manager", "Founder", "Other"];
const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];
const GOALS = [
  ["Pipeline review", "Bars"], ["Call & meeting summaries", "Chat"], ["Prospect research", "Search"],
  ["Forecasting", "Trend"], ["Follow-up drafting", "Mail"], ["Deal risk alerts", "Bell"],
];

// The Ampersand integration NAME for Google Calendar (amp.yaml: "Google").
function googleIntegration() {
  const c = getConnectors().find((x) => (x.provider || "").toLowerCase() === "google" || /google/i.test(x.name || ""));
  return c?.ampersandName || c?.provider || "Google";
}

export function Onboarding({ initial, onFinish, onCancel }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => ({ name: "", email: "", company: "", role: "", size: "", goals: [], ...(initial || {}) }));
  const [cal, setCal] = useState(initial?.calendar ? "connected" : "idle"); // idle | connecting | connected
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleGoal = (g) => setF((s) => ({ ...s, goals: s.goals.includes(g) ? s.goals.filter((x) => x !== g) : [...s.goals, g] }));

  const steps = ["About you", "Focus", "Calendar"];
  const canNext = step === 0 ? f.name.trim() && f.email.trim() : true;
  const finish = () => onFinish({ ...f, calendar: cal === "connected" });

  const amp = getAmpersand();

  let body;
  if (step === 0) {
    body = (
      <div className="ob-form">
        <div className="fld-row">
          <label className="fld-wrap"><span className="fld-label">Full name</span>
            <input className="fld" value={f.name} placeholder="Jane Rivera" onChange={(e) => set("name", e.target.value)} /></label>
          <label className="fld-wrap"><span className="fld-label">Work email</span>
            <input className="fld" type="email" value={f.email} placeholder="jane@company.com" onChange={(e) => set("email", e.target.value)} /></label>
        </div>
        <label className="fld-wrap"><span className="fld-label">Company</span>
          <input className="fld" value={f.company} placeholder="Acme Inc." onChange={(e) => set("company", e.target.value)} /></label>
        <div className="fld-wrap"><span className="fld-label">Your role</span>
          <div className="chip-grid">{ROLES.map((r) => <button key={r} className={"choice-chip" + (f.role === r ? " on" : "")} onClick={() => set("role", r)}>{r}</button>)}</div></div>
        <div className="fld-wrap"><span className="fld-label">Team size</span>
          <div className="chip-grid">{TEAM_SIZES.map((s) => <button key={s} className={"choice-chip" + (f.size === s ? " on" : "")} onClick={() => set("size", s)}>{s}</button>)}</div></div>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div className="ob-form">
        <div className="fld-wrap">
          <span className="fld-hint" style={{ marginTop: 0 }}>Pick a few — you can change this anytime.</span>
          <div className="goal-grid">{GOALS.map(([g, ic]) => (
            <button key={g} className={"goal-card" + (f.goals.includes(g) ? " on" : "")} onClick={() => toggleGoal(g)}>
              <span className="goal-ic">{React.createElement(Icons[ic] || Icons.Spark, { size: 17 })}</span>
              <span className="goal-nm">{g}</span>
              <span className="goal-check">{f.goals.includes(g) ? <Icons.Check size={13} /> : null}</span>
            </button>
          ))}</div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="ob-cal">
        <div className="gcal-card">
          <div className="gcal-head">
            <span className="gcal-logo"><Logos.Google /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gcal-title">Google Calendar</div>
              <div className="gcal-sub">So your agent knows what meetings are coming up</div>
            </div>
            {cal === "connected" ? <span className="gcal-badge"><Icons.Check size={14} /> Connected</span> : null}
          </div>
          <div className="gcal-perms">
            {["See your calendars & events", "Read attendee & meeting details", "Match meetings to deals automatically"].map((p) => (
              <div key={p} className="gcal-perm"><Icons.Check size={14} style={{ color: "var(--mint-muted)" }} /> {p}</div>
            ))}
          </div>
          {cal === "connected" ? (
            <div className="gcal-account">
              <span className="gcal-gm"><Logos.Google /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div className="gcal-acc-nm">{f.name || "You"}</div>
                <div className="gcal-acc-em">{f.email || "you@company.com"}</div>
              </span>
              <span className="gcal-syncing">Syncing events…</span>
            </div>
          ) : cal === "connecting" ? (
            <Suspense fallback={<div style={{ padding: 16, textAlign: "center", color: "var(--fg-muted)" }}>Loading…</div>}>
              <AmpersandConnect
                integration={googleIntegration()}
                project={amp.projectId}
                apiKey={amp.apiKey}
                groupRef={amp.groupRef}
                consumerRef={amp.consumerRef}
                onToast={() => {}}
                onDone={() => setCal("connected")}
              />
            </Suspense>
          ) : (
            <button className="gcal-btn" onClick={() => {
              if (amp.configured && amp.apiKey) setCal("connecting");
              else setCal("connected"); // no Ampersand configured — let them proceed
            }}>
              <span className="gbtn-g"><Logos.Google /></span> Connect Google Calendar
            </button>
          )}
        </div>
        <p className="ob-cal-foot">AmpUp only reads your calendar. You can disconnect anytime from Connectors.</p>
      </div>
    );
  }

  return (
    <div className="flow-overlay">
      <div className="ob-shell">
        <div className="ob-aside">
          <div className="ob-brand"><LogoMark size={26} /><span>AmpUp</span></div>
          <div className="ob-aside-body">
            <div className="ob-aside-eyebrow">Set up your workspace</div>
            <h2 className="ob-aside-title">A few quick things and your agent is ready.</h2>
            <div className="ob-steps">{steps.map((s, i) => (
              <div key={s} className={"ob-step" + (i === step ? " active" : "") + (i < step ? " done" : "")}>
                <span className="ob-step-dot">{i < step ? <Icons.Check size={13} /> : i + 1}</span>
                <span>{s}</span>
              </div>
            ))}</div>
          </div>
          <div className="ob-aside-foot"><Icons.Spark size={14} /> Takes about a minute</div>
        </div>
        <div className="ob-main">
          <div className="ob-main-head">
            <div>
              <div className="ob-eyebrow">Step {step + 1} of {steps.length}</div>
              <h1 className="ob-h1">{step === 0 ? "Tell us about you" : step === 1 ? "Set your agent’s focus" : "Connect Google Calendar"}</h1>
            </div>
            {onCancel ? <button className="icon-btn" onClick={onCancel} title="Close"><Icons.X size={18} /></button> : null}
          </div>
          <div className="ob-scroll">{body}</div>
          <div className="ob-foot">
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><Icons.ArrowLeft size={16} /> Back</button> : <span />}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {step === 2 && cal !== "connected" ? <button className="btn btn-ghost" onClick={finish}>Skip for now</button> : null}
              {step < 2
                ? <button className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <Icons.ArrowRight size={16} /></button>
                : <button className="btn btn-primary btn-lg" onClick={finish}>{cal === "connected" ? "Finish setup" : "Finish"} <Icons.ArrowRight size={16} /></button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
