import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/powiadomienia")({
  head: () => ({ meta: [{ title: "Powiadomienia — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/powiadomienia" title="Powiadomienia" />,
});
