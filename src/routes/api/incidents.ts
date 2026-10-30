import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/pp/http";

export const Route = createFileRoute("/api/incidents")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const s = await import("@/lib/pp/service.server");
          const params = Object.fromEntries(new URL(request.url).searchParams);
          return s.listIncidents(s.listSchema.parse(params));
        }),
      POST: ({ request }) =>
        handle(async () => {
          const s = await import("@/lib/pp/service.server");
          const body = await request.json().catch(() => ({}));
          return s.createIncident(s.createSchema.parse(body));
        }),
    },
  },
});
