import { TripHeader } from "@/components/navigation/TripHeader";
import { TripSectionNav } from "@/components/navigation/TripSectionNav";
import { ROUTE_TEMPLATE_ID } from "@/lib/routing/routes";

// Prerender a template for one placeholder ID; the service worker serves it
// offline for any trip ID. Other IDs render on demand with identical output.
// Never read `params` here: server output must not depend on route IDs.
export function generateStaticParams() {
  return [{ id: ROUTE_TEMPLATE_ID }];
}

export default function TripLayout({ children }: LayoutProps<"/trips/[id]">) {
  return (
    <>
      <TripHeader />
      <TripSectionNav />
      {children}
    </>
  );
}
