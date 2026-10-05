import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

/** The topmost open sheet. */
export function sheet(page: Page): Locator {
  return page.locator("dialog[open]").last();
}

export async function noOpenSheet(page: Page): Promise<void> {
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

/** Opens the app once online and waits until the service worker controls the page. */
export async function installApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load isn't controlled yet; after a reload it is.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

export interface TripFields {
  name: string;
  start: string;
  end: string;
}

/** Creates a trip from the Trips screen (which opens its plan) and returns its path (e.g. /trips/<id>). */
export async function createTrip(page: Page, { name, start, end }: TripFields): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: /Create a trip|New trip/ }).first().tap();
  await sheet(page).getByLabel("Trip name").fill(name);
  await sheet(page).getByLabel("Start").fill(start);
  await sheet(page).getByLabel("End").fill(end);
  await sheet(page).getByRole("button", { name: "Create trip" }).tap();
  await page.waitForURL(/\/trips\/[0-9a-f-]{36}\/plan$/);
  return new URL(page.url()).pathname.replace(/\/plan$/, "");
}

/** Adds an activity to the first day card of the Plan screen. */
export async function addActivityToFirstDay(page: Page, tripPath: string, title: string): Promise<void> {
  await page.goto(`${tripPath}/plan?view=days`);
  const firstDay = page.locator("article").first();
  await firstDay.getByRole("button", { name: /^Add to Day/ }).tap();
  await firstDay.getByRole("button", { name: "Add activity" }).tap();
  await sheet(page).getByLabel("Title").fill(title);
  await sheet(page).getByRole("button", { name: "Add activity" }).tap();
  await noOpenSheet(page);
  await expect(page.locator("article").first()).toContainText(title);
}
