import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/sprzedaz")({
  head: () => ({ meta: [{ title: "Sprzedaż — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/sprzedaz" title="Sprzedaż" />,
});
