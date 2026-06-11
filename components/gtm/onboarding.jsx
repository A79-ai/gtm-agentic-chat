// First-run onboarding wizard: collect details, pick focus, and connect
// Google Calendar via the real Ampersand widget. Full-screen overlay shown on
// first run (and re-openable from the profile menu).
import React, { Suspense, useState } from "react";
import { ampersandGroupRef, seedInstallation, useMcpKeyContext } from "@/lib/gtm/auth";
import { getAmpersand, getConnectors } from "@/lib/gtm/data";
import { Icons, LogoMark, Logos } from "./icons";

const CalendarConnect = React.lazy(() => import("./CalendarConnect"));

const ROLES = ["Account Executive", "SDR / BDR", "RevOps", "Sales Manager", "Founder", "Other"];
const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];
const GOALS = [
  ["Pipeline review", "Bars"],
  ["Call & meeting summaries", "Chat"],
  ["Prospect research", "Search"],
  ["Forecasting", "Trend"],
  ["Follow-up drafting", "Mail"],
  ["Deal risk alerts", "Bell"],
];

// The Ampersand integration NAME for Google Calendar (amp.yaml: "Google").
function googleIntegration() {
  const c = getConnectors().find(
    (x) => (x.provider || "").toLowerCase() === "google" || /google/i.test(x.name || "")
  );
  return c?.ampersandName || c?.provider || "Google";
}

export function Onboarding({ initial, onFinish, onCancel, collectIdentity = true }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => ({
    name: "",
    email: "",
    company: "",
    role: "",
    size: "",
    goals: [],
    ...(initial || {}),
  }));
  const [cal, setCal] = useState(initial?.calendar ? "connected" : "idle"); // idle | connecting | connected
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggleGoal = (g) =>
    setF((s) => ({
      ...s,
      goals: s.goals.includes(g) ? s.goals.filter((x) => x !== g) : [...s.goals, g],
    }));

  // Signup already collects name/email/company, so drop the "About you" step
  // when identity is in hand (avoid asking the same questions twice).
  const stepKeys = collectIdentity ? ["about", "focus", "calendar"] : ["focus", "calendar"];
  const labels = { about: "About you", focus: "Focus", calendar: "Calendar" };
  const key = stepKeys[step];
  const steps = stepKeys.map((k) => labels[k]);
  const isLast = step === stepKeys.length - 1;
  const canNext = key === "about" ? f.name.trim() && f.email.trim() : true;
  const finish = () => onFinish({ ...f, calendar: cal === "connected" });

  const amp = getAmpersand();
  // Google Calendar is a user-scoped install in the (shared) free-trial org, so
  // connect at `org_id:user_id` so a fresh user gets a clean OAuth connect rather
  // than the org's shared installation. Falls back to the org ref otherwise.
  const { userId, orgId } = useMcpKeyContext();
  const calGroupRef = userId && orgId ? ampersandGroupRef(orgId, userId, "user") : amp.groupRef;
  const calConsumerRef = userId || amp.consumerRef;

  let body;
  if (key === "about") {
    body = (
      <div className="ob-form">
        <div className="fld-row">
          <label className="fld-wrap">
            <span className="fld-label">Full name</span>
            <input
              className="fld"
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jane Rivera"
              value={f.name}
            />
          </label>
          <label className="fld-wrap">
            <span className="fld-label">Work email</span>
            <input
              className="fld"
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@company.com"
              type="email"
              value={f.email}
            />
          </label>
        </div>
        <label className="fld-wrap">
          <span className="fld-label">Company</span>
          <input
            className="fld"
            onChange={(e) => set("company", e.target.value)}
            placeholder="Acme Inc."
            value={f.company}
          />
        </label>
        <div className="fld-wrap">
          <span className="fld-label">Your role</span>
          <div className="chip-grid">
            {ROLES.map((r) => (
              <button
                className={"choice-chip" + (f.role === r ? " on" : "")}
                key={r}
                onClick={() => set("role", r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="fld-wrap">
          <span className="fld-label">Team size</span>
          <div className="chip-grid">
            {TEAM_SIZES.map((s) => (
              <button
                className={"choice-chip" + (f.size === s ? " on" : "")}
                key={s}
                onClick={() => set("size", s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  } else if (key === "focus") {
    body = (
      <div className="ob-form">
        <div className="fld-wrap">
          <span className="fld-hint" style={{ marginTop: 0 }}>
            Pick a few. You can change this anytime.
          </span>
          <div className="goal-grid">
            {GOALS.map(([g, ic]) => (
              <button
                className={"goal-card" + (f.goals.includes(g) ? " on" : "")}
                key={g}
                onClick={() => toggleGoal(g)}
              >
                <span className="goal-ic">
                  {React.createElement(Icons[ic] || Icons.Spark, { size: 17 })}
                </span>
                <span className="goal-nm">{g}</span>
                <span className="goal-check">
                  {f.goals.includes(g) ? <Icons.Check size={13} /> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="ob-cal">
        <div className="gcal-card">
          <div className="gcal-head">
            <span className="gcal-logo">
              <Logos.Google />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gcal-title">Google Calendar</div>
              <div className="gcal-sub">So your agent knows what meetings are coming up</div>
            </div>
            {cal === "connected" ? (
              <span className="gcal-badge">
                <Icons.Check size={14} /> Connected
              </span>
            ) : null}
          </div>
          <div className="gcal-perms">
            {[
              "See your calendars & events",
              "Read attendee & meeting details",
              "Match meetings to deals automatically",
            ].map((p) => (
              <div className="gcal-perm" key={p}>
                <Icons.Check size={14} style={{ color: "var(--mint-muted)" }} /> {p}
              </div>
            ))}
          </div>
          {cal === "connected" ? (
            <>
              <div className="gcal-account">
                <span className="gcal-gm">
                  <Logos.Google />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div className="gcal-acc-nm">{f.name || "You"}</div>
                  <div className="gcal-acc-em">{f.email || "you@company.com"}</div>
                </span>
                <span className="gcal-syncing">Syncing events…</span>
              </div>
              <div className="gcal-sync-note">
                <Icons.Clock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Your calendar syncs in the background. Events keep refreshing about every 10
                  minutes. You can finish setup now; there's nothing to wait for.
                </span>
              </div>
            </>
          ) : cal === "connecting" ? (
            <div className="gcal-amp">
              <Suspense
                fallback={
                  <div style={{ padding: 16, textAlign: "center", color: "var(--fg-muted)" }}>
                    Loading…
                  </div>
                }
              >
                <CalendarConnect
                  apiKey={amp.apiKey}
                  consumerRef={calConsumerRef}
                  groupRef={calGroupRef}
                  integration={googleIntegration()}
                  module="calendar"
                  onDone={() => setCal("connected")}
                  onInstalled={(id, config) =>
                    seedInstallation(id, config, {
                      integration: googleIntegration(),
                      groupRef: calGroupRef,
                      provider: "google",
                    })
                  }
                  onToast={() => {}}
                  project={amp.projectId}
                  provider="google"
                />
              </Suspense>
            </div>
          ) : (
            <button
              className="gcal-btn"
              onClick={() => {
                if (amp.configured && amp.apiKey) {
                  setCal("connecting");
                } else {
                  setCal("connected"); // no Ampersand configured, let them proceed
                }
              }}
            >
              <span className="gbtn-g">
                <Logos.Google />
              </span>{" "}
              Connect Google Calendar
            </button>
          )}
        </div>
        <p className="ob-cal-foot">
          AmpUp only reads your calendar. You can disconnect anytime from Connectors.
        </p>
      </div>
    );
  }

  return (
    <div className="flow-overlay">
      <div className="ob-shell">
        <div className="ob-aside">
          <div className="ob-brand">
            <LogoMark size={26} />
            <span>AmpUp</span>
          </div>
          <div className="ob-aside-body">
            <div className="ob-aside-eyebrow">Set up your workspace</div>
            <h2 className="ob-aside-title">A few quick things and your agent is ready.</h2>
            <div className="ob-steps">
              {steps.map((s, i) => (
                <div
                  className={"ob-step" + (i === step ? " active" : "") + (i < step ? " done" : "")}
                  key={s}
                >
                  <span className="ob-step-dot">
                    {i < step ? <Icons.Check size={13} /> : i + 1}
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ob-aside-foot">
            <Icons.Spark size={14} /> Takes about a minute
          </div>
        </div>
        <div className="ob-main">
          <div className="ob-main-head">
            <div>
              <div className="ob-eyebrow">
                Step {step + 1} of {steps.length}
              </div>
              <h1 className="ob-h1">
                {key === "about"
                  ? "Tell us about you"
                  : key === "focus"
                    ? "Set your agent’s focus"
                    : "Connect Google Calendar"}
              </h1>
            </div>
            {onCancel ? (
              <button className="icon-btn" onClick={onCancel} title="Close">
                <Icons.X size={18} />
              </button>
            ) : null}
          </div>
          <div className="ob-scroll">{body}</div>
          <div className="ob-foot">
            {step > 0 ? (
              <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
                <Icons.ArrowLeft size={16} /> Back
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {key === "calendar" && cal !== "connected" ? (
                <button className="btn btn-ghost" onClick={finish}>
                  Skip for now
                </button>
              ) : null}
              {isLast ? (
                <button className="btn btn-primary btn-lg" onClick={finish}>
                  {cal === "connected" ? "Finish setup" : "Finish"} <Icons.ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!canNext}
                  onClick={() => setStep(step + 1)}
                >
                  Continue <Icons.ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
