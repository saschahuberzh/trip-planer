/**
 * JSON backup (Phase 11): export as a download, restore it in a fresh installation
 * (new browser context = empty IndexedDB), and refuse an invalid file without changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addActivityToFirstDay, createTrip, goOffline, installApp } from "./helpers";

test("export and restore into a fresh installation; invalid files change nothing", async ({ browser, context, page }, testInfo) => {
  await installApp(page);
  const tripPath = await createTrip(page, { name: "Backup trip", start: "2027-09-01", end: "2027-09-03" });
  await addActivityToFirstDay(page, tripPath, "Old town walk");
  await page.goto("/countries");
  await page.getByLabel("Search countries").fill("japan");
  await page.getByLabel("Japan").click();
  await expect(page.getByText("1 country visited")).toBeVisible();

  // Export works offline too.
  await goOffline(context);
  await page.goto("/settings");
  await expect(page.getByText("Last export: never")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).tap()]);
  expect(download.suggestedFilename()).toMatch(/^travel-planner-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
  const backupPath = testInfo.outputPath("backup.json");
  await download.saveAs(backupPath);
  await expect(page.getByText("Last export: never")).toHaveCount(0);
  expect(JSON.parse(readFileSync(backupPath, "utf8"))).toMatchObject({ format: "travel-planner-backup", version: 2, visitedCountries: [{ countryCode: "JP" }] });

  // A fresh installation: new context, no data.
  const fresh = await browser.newContext();
  const app = await fresh.newPage();
  await app.goto("/");
  await expect(app.getByText("Plan your first trip")).toBeVisible();
  await app.goto("/settings");

  // An invalid file is refused and nothing changes.
  const invalidPath = testInfo.outputPath("invalid.json");
  writeFileSync(invalidPath, JSON.stringify({ format: "travel-planner-backup", version: 1, trips: [{ id: "x" }] }));
  await app.getByLabel("Choose backup file").setInputFiles(invalidPath);
  await expect(app.getByText("can't be restored. Nothing was changed.")).toBeVisible();

  // The real backup: summary, explicit confirmation, restore.
  await app.getByLabel("Choose backup file").setInputFiles(backupPath);
  await expect(app.getByText("is a valid backup")).toBeVisible();
  await expect(app.getByText("Trips: Backup trip")).toBeVisible();
  await expect(app.getByText("All current data on this device will be replaced")).toBeVisible();
  await app.getByRole("button", { name: "Replace my data" }).tap();
  await expect(app.getByText("Backup restored (1 trip).")).toBeVisible();
  await expect(app.getByLabel("Safety backups").getByRole("button", { name: "Export" })).toHaveCount(1);

  await app.goto(tripPath + "/plan?view=days");
  await expect(app.getByRole("heading", { name: "Backup trip" })).toBeVisible();
  await expect(app.locator("article").first()).toContainText("Old town walk");
  await app.goto("/countries");
  await expect(app.getByText("1 country visited")).toBeVisible();
  await fresh.close();
});
