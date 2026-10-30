import { createFileRoute } from "@tanstack/react-router";
import { handle, assertUuid } from "@/lib/pp/http";

export const Route = createFileRoute("/api/incidents/$id/analyze")({
  server: {
    handlers: {
      POST: ({ params, request }) =>
        handle(async () => {
          assertUuid(params.id);
          const body = (await request.json().catch(() => ({}))) as { force?: boolean };
          const s = await import("@/lib/pp/service.server");
          return s.analyze(params.id, body.force === true);
        }),
    },
  },
});
