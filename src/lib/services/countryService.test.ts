import { afterEach, describe, expect, it } from "vitest";
import { TravelDatabase } from "@/lib/db/database";
import { ValidationError } from "@/lib/domain/validation";
import { createRepositories } from "@/lib/repositories";
import { createCountryService } from "./countryService";

let db: TravelDatabase;

afterEach(async () => {
  await db.delete();
});

function service() {
  db = new TravelDatabase(`country-test-${crypto.randomUUID()}`);
  return createCountryService(createRepositories(db));
}

describe("country service", () => {
  it("marks and unmarks countries, listing codes sorted", async () => {
    const countries = service();
    await countries.setVisited("UZ", true);
    await countries.setVisited("CH", true);
    await countries.setVisited("UZ", true);
    expect(await countries.listVisitedCodes()).toEqual(["CH", "UZ"]);
    await countries.setVisited("UZ", false);
    expect(await countries.listVisitedCodes()).toEqual(["CH"]);
  });

  it("rejects codes that aren't on the country list", async () => {
    const countries = service();
    await expect(countries.setVisited("ZZ", true)).rejects.toThrow(ValidationError);
    expect(await countries.listVisitedCodes()).toEqual([]);
  });
});
