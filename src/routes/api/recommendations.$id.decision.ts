import { createFileRoute } from "@tanstack/react-router";
import { handle, assertUuid } from "@/lib/pp/http";

export const Route = createFileRoute("/api/recommendations/$id/decision")({
  server: {
    handlers: {
      POST: ({ params, request }) =>
        handle(async () => {
          assertUuid(params.id);
          const s = await import("@/lib/pp/service.server");
          const body = await request.json().catch(() => ({}));
          return s.decide(params.id, s.decisionSchema.parse(body));
        }),
    },
  },
});
