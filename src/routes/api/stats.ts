import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/pp/http";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: () => handle(async () => (await import("@/lib/pp/service.server")).stats()),
    },
  },
});
