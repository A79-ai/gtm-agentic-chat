import { expect, test } from "@playwright/test";
import { isMultiTenant } from "./helpers";

// Login experience — runs against a multi-tenant deployment (e.g. prod). It
// needs no credentials: it asserts the Welcome screen renders and that the CTAs
// hand off to Auth0 Universal Login. On the single-org bench (no login) it
// skips. Point E2E_BASE_URL at the deployed app to exercise it.
test.describe("login experience", () => {
  test("welcome screen offers sign-up + log-in and routes to Auth0", async ({ page }) => {
    await page.goto("/");
    test.skip(!(await isMultiTenant(page)), "no login screen on the single-org bench");

    // Both CTAs are present on the marketing splash.
    await expect(page.getByRole("button", { name: /get started/i }).first()).toBeVisible();
    const login = page.getByRole("button", { name: /log in/i }).first();
    await expect(login).toBeVisible();

    // Clicking Log in hands off to Auth0 Universal Login.
    await login.click();
    await page.waitForURL(/auth0\.com|\/u\/login|\/authorize/i, { timeout: 20_000 });
    expect(page.url()).toMatch(/auth0\.com|\/u\/login|\/authorize/i);
  });
});
