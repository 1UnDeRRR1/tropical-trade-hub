import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dostawy")({
  head: () => ({ meta: [{ title: "Dostawy — Tropical Trade Platform" }] }),
  component: () => <Outlet />,
});
