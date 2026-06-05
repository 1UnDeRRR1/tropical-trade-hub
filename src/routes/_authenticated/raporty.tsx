import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/raporty")({
  head: () => ({ meta: [{ title: "Raporty — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/raporty" title="Raporty" />,
});
