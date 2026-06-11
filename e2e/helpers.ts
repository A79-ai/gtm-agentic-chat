import type { Page } from "@playwright/test";

// In the single-org bench the app renders straight into the workspace; the
// multi-tenant deployment shows the Welcome screen with a "Log in" CTA first.
// Specs use this to self-gate so the same suite is safe against either target.
export async function isMultiTenant(page: Page): Promise<boolean> {
  return await page
    .getByRole("button", { name: /log in/i })
    .first()
    .isVisible()
    .catch(() => false);
}

// Land straight in the workspace on the single-org bench. The bench disables the
// signup + onboarding overlays via env (NEXT_PUBLIC_SIGNUP_ENABLED /
// NEXT_PUBLIC_ONBOARDING_ENABLED = false); we also clear any leftover first-run
// localStorage so a reused profile can't resurface an overlay that intercepts
// clicks. (Don't seed a signup account — its email triggers a billing-status
// refetch loop that never settles.)
export async function enterApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("ampup-onboarded:local", "1");
      localStorage.setItem("ampup-onboarded", "1");
    } catch {
      // localStorage unavailable (private mode) — env flags still gate overlays.
    }
  });
}
