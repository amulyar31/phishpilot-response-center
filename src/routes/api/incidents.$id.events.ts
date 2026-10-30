import { createFileRoute } from "@tanstack/react-router";
import { handle, assertUuid } from "@/lib/pp/http";

export const Route = createFileRoute("/api/incidents/$id/events")({
  server: {
    handlers: {
      GET: ({ params }) =>
        handle(async () => {
          assertUuid(params.id);
          const s = await import("@/lib/pp/service.server");
          return s.getEvents(params.id);
        }),
    },
  },
});
