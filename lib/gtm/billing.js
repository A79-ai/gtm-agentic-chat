// Billing + trial state. Slice 1 ships the `demo` provider only: a per-browser
// trial clock and a mock subscription, so the template runs with zero external
// accounts. The `stripe` provider (hosted Checkout + Portal + webhooks, with
// Stripe as the source of truth) plugs in behind this same surface in a later
// slice — keep this interface small.
import { CONFIG } from "./config";

const ACCOUNT_KEY = "ampup-account";
const TRIAL_KEY = "ampup-trial-start";
const SUB_KEY = "ampup-subscription";

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

// ---- Workspace account (identity captured at signup; NOT real auth) ----
export const getAccount = () => readJSON(ACCOUNT_KEY);
export const isSignedUp = () => !!getAccount();
export function saveAccount(account) {
  write(ACCOUNT_KEY, JSON.stringify({ ...account, createdAt: account.createdAt || Date.now() }));
}

// ---- Trial clock (demo) ----
export function startTrial() {
  if (!read(TRIAL_KEY)) write(TRIAL_KEY, String(Date.now()));
}
export const getSubscription = () => readJSON(SUB_KEY);
export function setSubscription(sub) {
  write(SUB_KEY, sub ? JSON.stringify({ ...sub, since: sub.since || Date.now() }) : "");
}

const DAY_MS = 86_400_000;

/**
 * Current entitlement for the workspace. Returns one of:
 *  { state: "subscribed", plan }            — active paid plan
 *  { state: "trialing", daysLeft, totalDays }
 *  { state: "expired", totalDays }          — trial over, not subscribed
 *  { state: "none" }                        — no trial started / billing off
 */
export function billingStatus() {
  if (!CONFIG.billing.enabled) return { state: "none" };
  const sub = getSubscription();
  if (sub && sub.status === "active") return { state: "subscribed", plan: sub.plan || "pro" };
  const start = Number(read(TRIAL_KEY));
  if (!start) return { state: "none" };
  const total = CONFIG.billing.trialDays;
  const daysLeft = Math.ceil(total - (Date.now() - start) / DAY_MS);
  return daysLeft > 0
    ? { state: "trialing", daysLeft, totalDays: total }
    : { state: "expired", totalDays: total };
}

// Reset all billing/account state (used by the demo "restart" flow).
export function resetBilling() {
  [ACCOUNT_KEY, TRIAL_KEY, SUB_KEY].forEach((k) => { try { localStorage.removeItem(k); } catch {} });
}

// ---- Provider-routed actions (demo now; stripe later) ----
// Returns true if the action was handled locally (demo); stripe paths will
// redirect to a hosted Checkout/Portal URL instead.
export async function startCheckout(planId) {
  if (CONFIG.billing.provider === "stripe") {
    const res = await fetch("/api/billing/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, account: getAccount() }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.url) { window.location.href = res.url; return "redirect"; }
    return "error";
  }
  // demo: mark subscribed immediately
  setSubscription({ status: "active", plan: planId, provider: "demo" });
  return "subscribed";
}
