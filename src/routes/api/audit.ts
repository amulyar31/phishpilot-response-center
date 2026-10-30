import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/pp/http";

export const Route = createFileRoute("/api/audit")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const s = await import("@/lib/pp/service.server");
          return s.listAudit(s.auditSchema.parse(Object.fromEntries(new URL(request.url).searchParams)));
        }),
    },
  },
});
