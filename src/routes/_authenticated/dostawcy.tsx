import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export const Route = createFileRoute("/_authenticated/dostawcy")({
  head: () => ({ meta: [{ title: "Dostawcy — Tropical Trade Platform" }] }),
  component: () => <PlaceholderPage path="/dostawcy" title="Dostawcy" />,
});
