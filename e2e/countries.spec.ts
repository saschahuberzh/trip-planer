/**
 * Countries tab (Phase 15): marking countries works offline, including the world map,
 * whose outlines are bundled with the app (no tiles).
 */
import { expect, test } from "@playwright/test";
import { goOffline, installApp } from "./helpers";

test("countries can be marked offline and stay marked", async ({ context, page }) => {
  await installApp(page);
  await goOffline(context);

  await page.goto("/countries");
  await expect(page.getByText("Tap a country on the map or search the list")).toBeVisible();
  await expect(page.getByText("Loading map…")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText("can't be shown")).toHaveCount(0);

  await page.getByLabel("Search countries").fill("uzbek");
  await page.getByLabel("Uzbekistan").click();
  await expect(page.getByText("1 country visited")).toBeVisible();
  const selected = page.getByRole("region", { name: "Selected country" });
  await expect(selected).toContainText("Visited");

  await page.reload();
  await expect(page.getByText("1 country visited")).toBeVisible();
  await expect(page.getByRole("region", { name: "Visited (1)" }).or(page.getByText("Visited (1)"))).toBeVisible();
  await expect(page.getByLabel("Uzbekistan").first()).toBeChecked();

  await page.getByLabel("Uzbekistan").first().click();
  await expect(page.getByText("No countries yet.")).toBeVisible();
});
