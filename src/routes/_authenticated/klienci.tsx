import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/klienci")({
  head: () => ({ meta: [{ title: "Klienci — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/klienci" title="Klienci" />,
});
