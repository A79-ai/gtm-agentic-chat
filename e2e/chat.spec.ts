import { expect, test } from "@playwright/test";
import { enterApp, isMultiTenant } from "./helpers";

// Chat: runs against the single-org bench. Drives a real turn through the
// durable Workflow runtime end to end: open a chat, send a prompt, and assert
// the assistant streams a non-empty answer back (no hang, no error). Uses a
// deterministic echo prompt so the assertion doesn't depend on model phrasing.
test.describe("chat", () => {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
  });

  test("sends a message and streams an assistant reply", async ({ page }) => {
    await page.goto("/");
    test.skip(await isMultiTenant(page), "needs the single-org bench (no auth)");

    await page
      .getByRole("button", { name: /start a chat/i })
      .first()
      .click();

    const composer = page.getByRole("textbox").first();
    await expect(composer).toBeVisible();
    await composer.fill("Reply with exactly the single word PONG and nothing else.");
    await composer.press("Enter");

    // The user's message echoes into the transcript.
    await expect(page.locator(".msg-user .bubble").filter({ hasText: /PONG/i })).toBeVisible();

    // The assistant streams a non-empty reply containing the echoed token.
    const reply = page.locator(".msg-agent .bubble").last();
    await expect(reply).toContainText(/PONG/i, { timeout: 75_000 });
  });
});
