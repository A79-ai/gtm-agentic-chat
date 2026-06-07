// Plans & billing — driven by lib/gtm/config plans + live trial/subscription
// status. In demo mode "Upgrade" marks the workspace subscribed locally; with
// provider=stripe it redirects to hosted Checkout (see lib/gtm/billing).
import React, { useState } from "react";
import { Icons } from "./icons";
import { CONFIG, priceLabel } from "@/lib/gtm/config";
import { billingStatus, startCheckout } from "@/lib/gtm/billing";

function StatusStrip({ status }) {
  if (status.state === "subscribed") {
    return (
      <div className="trial-strip ok">
        <Icons.CheckCircle size={16} /> You’re on the <strong>Pro</strong> plan. Thanks for the support!
      </div>
    );
  }
  if (status.state === "trialing") {
    return (
      <div className="trial-strip">
        <Icons.Spark size={16} /> <strong>{status.daysLeft} day{status.daysLeft === 1 ? "" : "s"}</strong> left in your free trial.
      </div>
    );
  }
  if (status.state === "expired") {
    return (
      <div className="trial-strip warn">
        <Icons.Bell size={16} /> Your free trial has ended — upgrade to keep your agent running.
      </div>
    );
  }
  return null;
}

export function PlansScreen({ onToast }) {
  const [status, setStatus] = useState(() => billingStatus());
  const plans = CONFIG.billing.plans;
  const subscribed = status.state === "subscribed";

  const onPick = async (p) => {
    if (p.id === "enterprise") { onToast("Opening sales contact…", "info"); return; }
    if (p.id === "trial") {
      onToast(status.state === "trialing" ? "Your free trial is already active 🎉" : `Your ${CONFIG.billing.trialDays}-day free trial is active 🎉`, "success");
      return;
    }
    const r = await startCheckout(p.id);
    if (r === "subscribed") { setStatus(billingStatus()); onToast("You’re on Pro now — thank you! 🎉", "success"); }
    else if (r === "redirect") { /* navigating to hosted checkout */ }
    else onToast("Couldn’t start checkout — check your billing configuration.", "error");
  };

  const ctaFor = (p) => {
    if (p.id === "trial") return status.state === "trialing" ? { label: "Trial active", disabled: true } : { label: p.cta, disabled: false };
    if (p.id === "pro") return subscribed ? { label: "Current plan", disabled: true } : { label: p.cta, disabled: false };
    return { label: p.cta, disabled: false };
  };

  return (
    <div className="scroll" style={{ flex: 1 }}>
      <div className="screen-pad" style={{ maxWidth: 1100, margin: "0 auto" }}>
        {CONFIG.billing.enabled && <StatusStrip status={status} />}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Pricing</div>
          <h2 style={{ marginBottom: 8 }}>Simple, usage-ready pricing</h2>
          <p style={{ fontSize: 14.5, color: "var(--fg-muted)", maxWidth: 520, margin: "0 auto" }}>
            Start free for {CONFIG.billing.trialDays} days. Keep going for {priceLabel(plans.find((p) => p.id === "pro")?.price)}/month — or talk to us for enterprise.
          </p>
        </div>
        <div className="agent-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "stretch" }}>
          {plans.map((p) => {
            const cta = ctaFor(p);
            return (
              <div key={p.id} className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, border: p.highlight ? "1.5px solid var(--accent)" : "1px solid var(--border-default)", position: "relative", boxShadow: p.highlight ? "0 0 0 3px var(--accent-glow)" : "var(--shadow-sm)" }}>
                {p.highlight && <span className="badge badge-accent" style={{ position: "absolute", top: 16, right: 16 }}>Most popular</span>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 17, color: "var(--fg-primary)" }}>{p.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                    <span style={{ fontFamily: "var(--font-hero)", fontSize: 34, color: "var(--fg-primary)" }}>{priceLabel(p.price)}</span>
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
                <button className={"btn " + (p.highlight ? "btn-primary" : "btn-outline")} disabled={cta.disabled} onClick={() => onPick(p)} style={{ width: "100%" }}>{cta.label}</button>
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--fg-muted)", marginTop: 20 }}>
          {CONFIG.billing.provider === "stripe" ? "Billed securely via Stripe. Cancel anytime." : "Demo billing — no real charges. Configure a provider to go live."}
        </p>
      </div>
    </div>
  );
}
