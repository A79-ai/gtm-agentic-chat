import { expect, test } from "@playwright/test";
import { enterApp, isMultiTenant } from "./helpers";

// Agent: create a custom agent in the builder, then open a chat scoped to it and
// assert the agent's system prompt actually drives the reply. Uses a
// deterministic required prefix so the assertion doesn't depend on model
// phrasing. Runs against the single-org bench; the multi-tenant deploy needs
// auth, so it self-skips (same pattern as chat.spec).
test.describe("agent", () => {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
  });

  test("creates a custom agent and chats with it", async ({ page }) => {
    await page.goto("/");
    test.skip(await isMultiTenant(page), "needs the single-org bench (no auth)");

    const name = `E2E Agent ${Date.now()}`;

    // Open the builder via the "Create from scratch" card, fill name + prompt.
    await page.getByRole("button", { name: /create from scratch/i }).click();
    await page.getByPlaceholder("e.g. Renewal Risk Analyst").fill(name);
    await page
      .getByPlaceholder(/describe the agent's role/i)
      .fill(
        "You are a terse echo agent. ALWAYS begin every reply with the exact prefix AGENT-OK: and nothing before it."
      );
    await page.getByRole("button", { name: /^create agent$/i }).click();

    // The new agent now appears as a card on the home screen.
    const card = page.locator(".card").filter({ hasText: name });
    await expect(card).toBeVisible();

    // Open a chat scoped to it and send a message.
    await card.click();
    const composer = page.getByRole("textbox").first();
    await expect(composer).toBeVisible();
    await composer.fill("Say hello in one short sentence.");
    await composer.press("Enter");

    // The user's message echoes into the transcript.
    await expect(page.locator(".msg-user .bubble").last()).toBeVisible();

    // The agent's system prompt drives the reply (the required prefix appears),
    // proving creation -> scoped chat works end to end.
    const reply = page.locator(".msg-agent .bubble").last();
    await expect(reply).toContainText(/AGENT-OK:/i, { timeout: 75_000 });
  });
});
