import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sesje")({
  head: () => ({ meta: [{ title: "Sesje transportowe — Tropical Trade Platform" }] }),
  component: () => <Outlet />,
});
