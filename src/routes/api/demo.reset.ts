import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/pp/http";

export const Route = createFileRoute("/api/demo/reset")({
  server: {
    handlers: {
      POST: () =>
        handle(async () => {
          const s = await import("@/lib/pp/service.server");
          return s.resetDemo();
        }),
    },
  },
});
