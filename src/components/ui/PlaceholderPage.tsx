import type { ReactNode } from "react";

type PlaceholderPageProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

/** Temporary page body for routes whose features arrive in later phases. */
export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
      {children}
    </section>
  );
}
