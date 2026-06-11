import { expect, test } from "@playwright/test";
import { enterApp, isMultiTenant } from "./helpers";

// Entity list-pages: runs against the single-org bench. For each entity type it
// loads /records/<type> and asserts the list renders against live data without
// the "count says N but list shows 0" regression the app has hit before: when
// the workspace count is non-zero, real rows must render (not the empty state).
const ENTITIES = [
  { type: "deal", plural: "deals" },
  { type: "account", plural: "accounts" },
  { type: "meeting", plural: "meetings" },
];

test.describe("entity list-pages", () => {
  test.beforeEach(async ({ page }) => {
    await enterApp(page);
  });

  for (const { type, plural } of ENTITIES) {
    test(`${plural} list loads live rows with a matching count`, async ({ page }) => {
      await page.goto(`/records/${type}`);
      test.skip(await isMultiTenant(page), "needs the single-org bench (no auth)");

      // The page header for this entity type.
      await expect(
        page.getByRole("heading", { name: new RegExp(`^${plural}$`, "i") })
      ).toBeVisible();

      // Wait for the list to settle: a row or the empty state, never stuck on
      // the loading spinner.
      const firstRow = page.locator(".erow, .ecard-list > *").first();
      const emptyState = page.getByText(new RegExp(`no ${plural} synced yet`, "i"));
      await expect(firstRow.or(emptyState)).toBeVisible({ timeout: 45_000 });

      // No error surfaced.
      await expect(page.getByText(/something went wrong|failed to load|unauthorized/i)).toHaveCount(
        0
      );

      // The subtitle reports the workspace count, e.g. "67 deals in your workspace".
      const subtitle = page.getByText(/in your workspace/i);
      await expect(subtitle).toBeVisible();
      const count = Number(
        (await subtitle.textContent())?.match(/\d[\d,]*/)?.[0]?.replace(/,/g, "")
      );

      if (count > 0) {
        // The regression guard: a non-zero count must render rows, never the
        // empty state ("count says N but list shows 0").
        await expect(emptyState).toHaveCount(0);
        await expect(firstRow).toBeVisible();
      }
    });
  }
});
