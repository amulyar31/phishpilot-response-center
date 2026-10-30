// Shared JSON envelope helpers for REST server routes.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; issues?: unknown } };

export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const err = e as { status?: number; code?: string; message?: string; issues?: unknown; name?: string };
    if (err?.name === "ZodError") return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: err.issues } }, { status: 400 });
    console.error("[api]", e);
    return Response.json({ ok: false, error: { code: err.code ?? "INTERNAL", message: err.status ? err.message : "Internal error" } }, { status: err.status ?? 500 });
  }
}

export const uuidRe = /^[0-9a-f-]{36}$/i;
export function assertUuid(id: string) {
  if (!uuidRe.test(id)) throw Object.assign(new Error("Invalid id"), { status: 400, code: "INVALID_ID" });
}
