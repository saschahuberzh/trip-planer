/**
 * Acceptance test of IMPLEMENTATION_PLAN.md Phase 10: the app starts offline after the
 * first visit, existing trips stay available and editable, and a trip created offline
 * can be opened in every section.
 */
import { expect, test } from "@playwright/test";
import { addActivityToFirstDay, createTrip, goOffline, installApp, noOpenSheet, sheet } from "./helpers";

test("trips stay available and editable offline; offline trips open in every section", async ({ context, page }) => {
  // 1–2. Open the application online and create a trip.
  await installApp(page);
  const tripPath = await createTrip(page, { name: "Silk Road", start: "2027-06-12", end: "2027-06-14" });
  await addActivityToFirstDay(page, tripPath, "Registan");

  // 3–4. Close the application and disable internet.
  await page.close();
  await goOffline(context);

  // 5–6. Start the app again: it loads from the service worker and the trip is there.
  const app = await context.newPage();
  await app.goto("/");
  await expect(app.getByText("Offline · your trips are saved on this device.")).toBeVisible();
  await expect(app.getByRole("link", { name: /Silk Road/ }).first()).toBeVisible();
  await app.goto(`${tripPath}/plan`);
  await expect(app.locator("article").first()).toContainText("Registan");

  // 7. The trip can still be edited. Old trip links open the plan.
  await app.goto(tripPath);
  await app.waitForURL(`**${tripPath}/plan`);
  await app.getByRole("button", { name: "Edit trip" }).tap();
  await sheet(app).getByLabel("Trip name").fill("Silk Road 2027");
  await sheet(app).getByRole("button", { name: "Save changes" }).tap();
  await noOpenSheet(app);
  await expect(app.getByRole("heading", { name: "Silk Road 2027" })).toBeVisible();
  await addActivityToFirstDay(app, tripPath, "Chorsu Bazaar");

  // 8. A trip created offline can be opened in every section (route templates).
  const offlineTrip = await createTrip(app, { name: "Offline trip", start: "2027-07-01", end: "2027-07-02" });
  const sections: [string, RegExp][] = [
    ["plan", /Day 1/i],
    ["map", /Route/],
    ["places", /Collect places to visit/],
    ["budget", /No expenses yet/],
    ["accommodation", /Where do you sleep\?/],
    ["bookings", /Keep your bookings at hand/],
  ];
  for (const [section, content] of sections) {
    // A full navigation, as when opening a link or reloading offline.
    await app.goto(`${offlineTrip}/${section}`);
    await expect(app.getByRole("heading", { name: "Offline trip" })).toBeVisible();
    await expect(app.locator("main")).toContainText(content);
  }
  await app.goto(`${offlineTrip}/plan`);
  await app.locator("article").first().getByRole("link").first().tap();
  await expect(app).toHaveURL(/\/plan\/[0-9a-f-]{36}$/);
  await app.reload();
  await expect(app.getByText("Places of the day")).toBeVisible();
});
