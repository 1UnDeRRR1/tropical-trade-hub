import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/magazyn")({
  head: () => ({ meta: [{ title: "Magazyn — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/magazyn" title="Magazyn" />,
});
