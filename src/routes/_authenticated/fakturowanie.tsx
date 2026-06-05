import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/fakturowanie")({
  head: () => ({ meta: [{ title: "Fakturowanie — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/fakturowanie" title="Fakturowanie" />,
});
