import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/uzytkownicy")({
  head: () => ({ meta: [{ title: "Użytkownicy — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/uzytkownicy" title="Użytkownicy" />,
});
