import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/przewoznicy")({
  head: () => ({ meta: [{ title: "Przewoźnicy — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/przewoznicy" title="Przewoźnicy" />,
});
