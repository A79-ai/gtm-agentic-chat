import { expect, test } from "@playwright/test";
import { enterApp, isMultiTenant } from "./helpers";

// File upload + question-on-file, against the single-org bench.
//
// Drives the real composer upload UI: click the clip, pick a text file through
// the OS file chooser, see it attach as a chip, then ask a question whose answer
// only lives inside that file and assert the agent answers from it. Uses a
// unique token so the assertion can't pass on model phrasing alone (mirrors
// chat.spec's PONG check).
//
// SCOPE: this covers the INLINE text path — a small text file (< 32KB, matching
// TEXT_FILE_RE in chat.jsx) is read in the browser and its full contents are
// embedded into the prompt via contextPreamble, so the agent answers with no
// tool call. It deliberately does NOT exercise /api/upload or the read_file MCP
// tool: against this bench upload_file returns {"id":null,"status":"uploading"}
// (async id, never surfaced), so the binary/read_file path can't deliver a
// datasource_id to the agent. See the file-upload bug note in the PR.
test.describe("file upload", () => {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
  });

  test("attaches a text file and answers a question from its contents", async ({ page }) => {
    await page.goto("/");
    test.skip(await isMultiTenant(page), "needs the single-org bench (no auth)");

    // Benign, explicitly-shareable content: a "do not share / secret" framing
    // makes the model refuse (it reads the file, then declines), which is a real
    // but unwanted failure mode for this test. Keep the token unique so the
    // assertion can't pass on phrasing alone, but the surrounding text neutral.
    const token = "ZEBRA-PINEAPPLE-7741";
    const fileName = `e2e-note-${Date.now()}.txt`;
    const fileBody = `Q3 release notes (shared with the whole team).\nThe build reference ID is ${token}.\nThe milestone review is scheduled for next quarter.`;

    await page
      .getByRole("button", { name: /start a chat/i })
      .first()
      .click();

    const composer = page.getByRole("textbox").first();
    await expect(composer).toBeVisible();

    // Click the clip; the composer opens the OS file picker on demand. Playwright
    // intercepts that chooser even though the <input> is created at click time.
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /upload a file/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(fileBody, "utf8"),
    });

    // The file attaches as a chip in the composer (inline text is usable at once).
    await expect(page.locator(".file-chip-name").filter({ hasText: fileName })).toBeVisible();

    await composer.fill(
      "What is the build reference ID in the attached file? Reply with only that ID."
    );
    await composer.press("Enter");

    // The agent answers from the file's embedded contents.
    const reply = page.locator(".msg-agent .bubble").last();
    await expect(reply).toContainText(token, { timeout: 75_000 });
  });
});
