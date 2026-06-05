import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/ustawienia")({
  head: () => ({ meta: [{ title: "Ustawienia — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/ustawienia" title="Ustawienia" />,
});
