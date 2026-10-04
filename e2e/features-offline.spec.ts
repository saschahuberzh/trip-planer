/**
 * Editing with every feature works offline (PWA-003): places, activities with a place,
 * transport, accommodation, bookings and expenses. Maps and place search need internet;
 * they fail gracefully.
 */
import { expect, test } from "@playwright/test";
import { createTrip, goOffline, installApp, noOpenSheet, sheet } from "./helpers";

test("all features can be used offline", async ({ context, page }) => {
  await installApp(page);
  await goOffline(context);
  const trip = await createTrip(page, { name: "Offline features", start: "2027-08-01", end: "2027-08-03" });

  // Place: online search reports offline; manual entry with coordinates works.
  await page.goto(`${trip}/places`);
  await page.getByRole("button", { name: "Add your first place" }).tap();
  await sheet(page).getByLabel("Search online").fill("Registan Samarkand");
  await expect(sheet(page).getByText("Search needs an internet connection")).toBeVisible();
  await sheet(page).getByRole("button", { name: "Enter details manually" }).tap();
  await sheet(page).getByLabel("Paste a map link or coordinates").fill("39.6548, 66.9758");
  await sheet(page).getByRole("button", { name: "Save place" }).tap();
  await noOpenSheet(page);
  await expect(page.locator("main")).toContainText("Registan Samarkand");

  // Day view: place of the day, visit a place, transport.
  await page.goto(`${trip}/plan`);
  await page.locator("article").first().getByRole("link").first().tap();
  await page.getByRole("button", { name: "Add place of the day" }).tap();
  await sheet(page).getByRole("button", { name: /Registan Samarkand/ }).tap();
  await noOpenSheet(page);
  await page.getByRole("button", { name: "Visit a place" }).tap();
  await sheet(page).getByRole("button", { name: /Registan Samarkand/ }).tap();
  await noOpenSheet(page);
  await page.getByRole("button", { name: "Add transport" }).tap();
  await sheet(page).getByRole("textbox", { name: "From" }).fill("Tashkent");
  await sheet(page).getByRole("textbox", { name: "To" }).fill("Samarkand");
  await sheet(page).getByLabel("Departure date").fill("2027-08-01");
  await sheet(page).getByLabel("Departure time", { exact: true }).fill("08:00");
  await sheet(page).getByLabel("Arrival time", { exact: true }).fill("10:10");
  await sheet(page).getByRole("button", { name: "Add transport" }).tap();
  await noOpenSheet(page);
  const timeline = page.locator("section[aria-label=Timeline]");
  await expect(timeline).toContainText("Registan Samarkand");
  await expect(timeline).toContainText("Tashkent → Samarkand");
  await expect(timeline).toContainText("2 h 10 min");

  // Map: no tiles offline, but the stops with coordinates are listed.
  await page.goto(`${trip}/map`);
  await expect(page.locator("main")).toContainText("can't be shown");
  await expect(page.locator("main")).toContainText("39.6548, 66.9758");

  // Accommodation.
  await page.goto(`${trip}/accommodation`);
  await page.getByRole("button", { name: "Add accommodation" }).tap();
  await sheet(page).getByLabel("Name").fill("Guesthouse");
  await sheet(page).getByRole("button", { name: "Add accommodation" }).tap();
  await noOpenSheet(page);
  await expect(page.locator("main")).toContainText("1 night");

  // Booking linked to the transport.
  await page.goto(`${trip}/bookings`);
  await page.getByRole("button", { name: "Add booking" }).tap();
  await sheet(page).getByLabel("For (optional)").selectOption({ index: 1 });
  await sheet(page).getByRole("button", { name: "Add booking" }).tap();
  await noOpenSheet(page);
  await expect(page.locator("main")).toContainText("Tashkent → Samarkand");

  // Expense with a manual exchange rate.
  await page.goto(`${trip}/budget`);
  await page.getByRole("button", { name: "Add expense" }).tap();
  await sheet(page).getByLabel("Amount", { exact: true }).fill("150000");
  await sheet(page).getByLabel("Currency").selectOption("UZS");
  await sheet(page).getByLabel(/^1 UZS = /).fill("0.0001");
  await sheet(page).getByLabel("Title").fill("Plov");
  await sheet(page).getByRole("button", { name: "Add expense" }).tap();
  await noOpenSheet(page);
  await expect(page.locator("main")).toContainText(/UZS\s150,000/);
  await expect(page.locator("main")).toContainText(/≈ EUR\s15/);

  // Everything is still there after an offline reload.
  await page.reload();
  await expect(page.locator("main")).toContainText("Plov");
});
