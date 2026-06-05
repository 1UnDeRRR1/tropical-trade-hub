import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/dostawy")({
  head: () => ({ meta: [{ title: "Dostawy — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/dostawy" title="Dostawy" />,
});
