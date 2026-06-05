import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/rozliczenia")({
  head: () => ({ meta: [{ title: "Rozliczenia — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/rozliczenia" title="Rozliczenia" />,
});
