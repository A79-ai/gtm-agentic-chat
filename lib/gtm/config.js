// Central, env-driven feature config for the template. CLIENT-SAFE: this module
// is imported across the SPA, so it must read only NEXT_PUBLIC_* values (and the
// Stripe *publishable* key). Server-only secrets (STRIPE_SECRET_KEY, webhook
// signing secret) are read directly in API routes — never here.
//
// Everything has a safe default so a fresh clone runs with zero env set. A
// deployer flips features per deployment via env vars (one org per deploy).
//
// IMPORTANT: read each flag as the LITERAL `process.env.NEXT_PUBLIC_*`. Next.js
// inlines these at build time only when referenced literally — aliasing
// `process.env` to a variable defeats the static replacement and the flag silently
// reverts to its default.
const bool = (v, d) => (v == null || v === "" ? d : /^(1|true|yes|on)$/i.test(String(v)));
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const trialDays = num(process.env.NEXT_PUBLIC_TRIAL_DAYS, 14);
const proPrice = num(process.env.NEXT_PUBLIC_PRICE_PRO, 50);
const currency = process.env.NEXT_PUBLIC_BILLING_CURRENCY || "USD";

// Plan catalogue. Editable here, or override the key knobs via env. `price` is a
// number (monthly, in `currency`) or null for "contact us".
const PLANS = [
  {
    id: "trial", name: "Free Trial", price: 0, unit: `for ${trialDays} days`, highlight: false,
    desc: `Everything in Pro, free for ${trialDays} days. No card required.`,
    features: ["Full agentic chat over your CRM", "Connect HubSpot, Salesforce, Gong + more", "AmpUp Notetaker", "Pre & post-meeting briefs"],
    cta: "Start free trial",
  },
  {
    id: "pro", name: "Pro", price: proPrice, unit: "per month", highlight: true,
    desc: "For individual reps and small teams running their pipeline through chat.",
    features: ["Everything in the trial", "Unlimited chats & connected sources", "Notetaker on every call", "Priority support"],
    cta: "Upgrade to Pro",
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || "", // Stripe Price id (provider=stripe)
  },
  {
    id: "enterprise", name: "Enterprise", price: null, unit: "let's talk", highlight: false,
    desc: "SSO, custom data residency, dedicated support and volume pricing.",
    features: ["Everything in Pro", "SSO & SCIM", "Custom integrations & MCP servers", "Dedicated success manager"],
    cta: "Contact us",
  },
];

export const CONFIG = {
  // Where the Enterprise "Contact us" / sales links email.
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@a79.ai",
  onboarding: {
    enabled: bool(process.env.NEXT_PUBLIC_ONBOARDING_ENABLED, true),
  },
  signup: {
    enabled: bool(process.env.NEXT_PUBLIC_SIGNUP_ENABLED, true),
  },
  billing: {
    enabled: bool(process.env.NEXT_PUBLIC_BILLING_ENABLED, true),
    provider: (process.env.NEXT_PUBLIC_BILLING_PROVIDER || "demo").toLowerCase(), // "demo" | "stripe"
    trialDays,
    cardRequired: bool(process.env.NEXT_PUBLIC_TRIAL_CARD_REQUIRED, false),
    currency,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    plans: PLANS,
  },
};

export function priceLabel(price) {
  if (price == null) return "Custom";
  if (price === 0) return "Free";
  const sym = CONFIG.billing.currency === "USD" ? "$" : `${CONFIG.billing.currency} `;
  return `${sym}${price}`;
}
