import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/pp/http";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: () => handle(async () => (await import("@/lib/pp/service.server")).configStatus()),
      PATCH: ({ request }) =>
        handle(async () => {
          const s = await import("@/lib/pp/service.server");
          return s.updateRule(s.ruleSchema.parse(await request.json().catch(() => ({}))));
        }),
    },
  },
});
