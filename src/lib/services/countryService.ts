/** Countries tab: which countries the user has visited (manual marks, not derived from trips). */
import { isKnownCountryCode } from "@/lib/countries/countries";
import { ValidationError } from "@/lib/domain/validation";
import { getRepositories, type Repositories } from "@/lib/repositories";

export function createCountryService(repos: Repositories) {
  return {
    /** Codes of all visited countries, sorted. */
    async listVisitedCodes(): Promise<string[]> {
      return (await repos.visitedCountries.list()).map((country) => country.countryCode).sort();
    },

    async setVisited(countryCode: string, visited: boolean): Promise<void> {
      if (!visited) {
        await repos.visitedCountries.remove(countryCode);
        return;
      }
      if (!isKnownCountryCode(countryCode)) throw new ValidationError("visited country", [`unknown country ${countryCode}`]);
      await repos.visitedCountries.add(countryCode);
    },
  };
}

export type CountryService = ReturnType<typeof createCountryService>;

let service: CountryService | null = null;

export function getCountryService(): CountryService {
  service ??= createCountryService(getRepositories());
  return service;
}
