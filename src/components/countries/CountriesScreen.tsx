"use client";

import { useMemo, useState, type ReactNode } from "react";
import { countryName, countryOptions, filterCountries, type CountryOption } from "@/lib/countries/countries";
import { useVisitedCountries } from "@/lib/hooks/useVisitedCountries";
import { getCountryService } from "@/lib/services/countryService";
import { Button } from "@/components/ui/Button";
import { CheckCircleIcon, CloseIcon, SearchIcon } from "@/components/ui/icons";
import { LoadError, ScreenSkeleton } from "@/components/ui/ScreenState";
import { inputClass } from "@/components/trips/formFields";
import { WorldMap } from "./WorldMap";

/** Countries tab: world map with visited countries filled, plus a searchable list. */
export function CountriesScreen() {
  const visited = useVisitedCountries();
  // Country names come from the browser, so everything below renders client-side only
  // (the "loading" state is what the server renders).
  if (visited.status === "loading") return <ScreenSkeleton label="Loading countries" />;
  if (visited.status === "error") return <LoadError what="Your countries" />;
  return <CountriesContent visited={visited.data} />;
}

function CountriesContent({ visited }: { visited: string[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => countryOptions(), []);
  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const visitedOptions = useMemo(() => options.filter((option) => visitedSet.has(option.code)), [options, visitedSet]);
  const results = useMemo(() => filterCountries(options, query), [options, query]);

  async function setVisited(code: string, value: boolean) {
    setError(null);
    try {
      await getCountryService().setVisited(code, value);
    } catch (cause) {
      console.error("Saving the country failed", cause);
      setError(`${countryName(code)} couldn't be saved. Please try again.`);
    }
  }

  const count = visited.length;
  return (
    <section className="mx-auto max-w-md space-y-4 px-4 py-6 lg:max-w-6xl lg:px-8 lg:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Countries</h1>
        <p className="mt-1 text-slate-600">
          {count === 0 ? "Tap a country on the map or search the list to mark it as visited." : `${count} ${count === 1 ? "country" : "countries"} visited`}
        </p>
      </header>

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-3 lg:sticky lg:top-6">
          <WorldMap
            visited={visited}
            selected={selected}
            onSelect={setSelected}
            className="aspect-[3/2] rounded-3xl ring-1 ring-slate-200 lg:aspect-[16/10]"
          />
          {selected !== null && (
            <SelectedCountry
              code={selected}
              visited={visitedSet.has(selected)}
              onChange={(value) => setVisited(selected, value)}
              onClose={() => setSelected(null)}
            />
          )}
          {error !== null && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-3 left-3 size-5 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              autoComplete="off"
              className={`${inputClass} bg-white pl-10`}
            />
          </div>

          {query.trim() === "" ? (
            <>
              <CountryGroup title={`Visited (${count})`} options={visitedOptions} visited={visitedSet} onChange={setVisited} onSelect={setSelected}>
                <p className="px-4 py-4 text-sm text-slate-500">No countries yet.</p>
              </CountryGroup>
              <CountryGroup title="All countries" options={options} visited={visitedSet} onChange={setVisited} onSelect={setSelected} />
            </>
          ) : (
            <CountryGroup title="Results" options={results} visited={visitedSet} onChange={setVisited} onSelect={setSelected}>
              <p className="px-4 py-4 text-sm text-slate-500">No country matches “{query.trim()}”.</p>
            </CountryGroup>
          )}
        </div>
      </div>
    </section>
  );
}

function SelectedCountry({
  code,
  visited,
  onChange,
  onClose,
}: {
  code: string;
  visited: boolean;
  onChange: (visited: boolean) => void;
  onClose: () => void;
}) {
  return (
    <section aria-label="Selected country" className="flex items-center gap-3 rounded-3xl bg-white py-3 pr-2 pl-4 shadow-sm ring-1 ring-slate-200">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold text-slate-900">{countryName(code)}</h2>
        <p className={`flex items-center gap-1 text-sm ${visited ? "text-teal-700" : "text-slate-500"}`}>
          {visited && <CheckCircleIcon className="size-4" />}
          {visited ? "Visited" : "Not visited yet"}
        </p>
      </div>
      <Button variant={visited ? "secondary" : "primary"} onClick={() => onChange(!visited)}>
        {visited ? "Remove" : "Mark as visited"}
      </Button>
      <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
        <CloseIcon />
      </button>
    </section>
  );
}

function CountryGroup({
  title,
  options,
  visited,
  onChange,
  onSelect,
  children,
}: {
  title: string;
  options: readonly CountryOption[];
  visited: ReadonlySet<string>;
  onChange: (code: string, visited: boolean) => void;
  onSelect: (code: string) => void;
  /** Shown when there are no options. */
  children?: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        {options.length === 0 ? (
          children
        ) : (
          <ul className="divide-y divide-slate-100">
            {options.map((option) => (
              <li key={option.code}>
                <label className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={visited.has(option.code)}
                    onChange={(event) => {
                      onChange(option.code, event.target.checked);
                      onSelect(option.code);
                    }}
                    className="size-5 shrink-0 accent-teal-700"
                  />
                  <span className="min-w-0 flex-1 text-slate-900">{option.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
