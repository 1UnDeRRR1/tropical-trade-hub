import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/logistyka")({
  head: () => ({ meta: [{ title: "Logistyka — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/logistyka" title="Logistyka" />,
});
