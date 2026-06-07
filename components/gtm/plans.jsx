// Plans — free trial → Pro ($50/mo) → Enterprise (contact us)
import React from "react";
import { Icons } from "./icons";

const PLANS = [
  {
    id: "trial", name: "Free Trial", price: "Free", unit: "for 30 days", highlight: false,
    desc: "Everything in Pro, free for 30 days. No card required.",
    features: ["Full agentic chat over your CRM", "Connect HubSpot, Salesforce, Gong + more", "AmpUp Notetaker", "Pre & post-meeting briefs"],
    cta: "Start free trial", tone: "outline",
  },
  {
    id: "pro", name: "Pro", price: "$50", unit: "per month", highlight: true,
    desc: "For individual reps and small teams running their pipeline through chat.",
    features: ["Everything in the trial", "Unlimited chats & connected sources", "Notetaker on every call", "Priority support"],
    cta: "Upgrade to Pro", tone: "primary",
  },
  {
    id: "enterprise", name: "Enterprise", price: "Custom", unit: "let's talk", highlight: false,
    desc: "SSO, custom data residency, dedicated support and volume pricing.",
    features: ["Everything in Pro", "SSO & SCIM", "Custom integrations & MCP servers", "Dedicated success manager"],
    cta: "Contact us", tone: "outline",
  },
];

export function PlansScreen({ onToast }) {
  const onPick = (p) => {
    if (p.id === "enterprise") onToast("Opening sales contact…", "info");
    else if (p.id === "trial") onToast("Your 30-day free trial is active 🎉", "success");
    else onToast("Redirecting to checkout…", "info");
  };
  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Pricing</div>
          <h2 style={{ marginBottom: 8 }}>Simple, usage-ready pricing</h2>
          <p style={{ fontSize: 14.5, color: "var(--fg-muted)", maxWidth: 520, margin: "0 auto" }}>
            Start free for 30 days. Keep going for $50/month — or talk to us for enterprise.
          </p>
        </div>
        <div className="agent-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "stretch" }}>
          {PLANS.map((p) => (
            <div key={p.id} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, border: p.highlight ? "1.5px solid var(--accent)" : "1px solid var(--border-default)", position: "relative", boxShadow: p.highlight ? "0 0 0 3px var(--accent-glow)" : "var(--shadow-sm)" }}>
              {p.highlight && <span className="badge badge-accent" style={{ position: "absolute", top: 16, right: 16 }}>Most popular</span>}
              <div>
                <div style={{ fontWeight: 600, fontSize: 17, color: "var(--fg-primary)" }}>{p.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                  <span style={{ fontFamily: "var(--font-hero)", fontSize: 34, color: "var(--fg-primary)" }}>{p.price}</span>
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{p.unit}</span>
                </div>
                <p style={{ fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 8 }}>{p.desc}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {p.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "var(--fg-body)" }}>
                    <Icons.Check size={15} style={{ color: "var(--mint-base)", flexShrink: 0, marginTop: 2 }} />{f}
                  </div>
                ))}
              </div>
              <button className={"btn " + (p.tone === "primary" ? "btn-primary" : "btn-outline")} onClick={() => onPick(p)} style={{ width: "100%" }}>{p.cta}</button>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--fg-muted)", marginTop: 20 }}>
          Billed through the Vercel Marketplace. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
