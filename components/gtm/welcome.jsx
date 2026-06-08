// Unauthenticated welcome / sign-in gate. Two-panel hero modeled on a79.ai:
// branded dark aside with the value prop, and a focused right panel offering
// both "Get started" (signup) and "Log in". Both route to Auth0 Universal Login
// for the free-trial org (which offers Google + email); a new user is
// auto-provisioned on first login, so "Get started" just hints the signup view.
import { Icons, LogoMark } from "./icons";

const PERKS = [
  "Chat grounded in your real CRM, calls & notes",
  "Connect HubSpot, Google, Gong, Fireflies + more",
  "Notetaker, meeting briefs & auto follow-ups",
];

export function Welcome({ onLogin, onSignup }) {
  return (
    <div className="flow-overlay">
      <div className="ob-shell">
        <div className="ob-aside">
          <div className="ob-brand"><LogoMark size={26} /><span>AmpUp</span></div>
          <div className="ob-aside-body">
            <div className="ob-aside-eyebrow">AI Sales Coaching Platform</div>
            <h2 className="ob-aside-title">
              Your stack records calls.<br />
              <span style={{ color: "var(--g-500)" }}>AmpUp wins deals.</span>
            </h2>
            <div className="ob-steps" style={{ gap: 12 }}>
              {PERKS.map((p) => (
                <div key={p} className="ob-step done" style={{ cursor: "default" }}>
                  <span className="ob-step-dot"><Icons.Check size={13} /></span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ob-aside-foot">
            <Icons.Spark size={14} /> Free 14-day trial · No credit card
          </div>
        </div>

        <div className="ob-main">
          <div className="ob-main-head">
            <div>
              <div className="ob-eyebrow">Welcome</div>
              <h1 className="ob-h1">Get started with AmpUp</h1>
            </div>
          </div>
          <div className="ob-scroll">
            <div className="ob-form" style={{ maxWidth: 380, gap: 14 }}>
              <p style={{ color: "var(--fg-muted)", margin: "0 0 4px", lineHeight: 1.55 }}>
                Spin up your GTM agent over your own CRM, meetings and knowledge base.
              </p>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center", gap: 8 }}
                onClick={onSignup}
              >
                Get started — it’s free <Icons.ArrowRight size={16} />
              </button>
              <button
                className="btn btn-outline btn-lg"
                style={{ width: "100%", justifyContent: "center" }}
                onClick={onLogin}
              >
                Log in
              </button>
              <p style={{ fontSize: 12.5, color: "var(--fg-muted)", textAlign: "center", margin: "4px 0 0", lineHeight: 1.5 }}>
                Continue with Google or email. New here? “Get started” creates your free workspace.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
