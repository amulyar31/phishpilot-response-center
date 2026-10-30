// Browser-side API client for PhishPilot REST endpoints.
export class ClientError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      body: init?.json !== undefined ? JSON.stringify(init.json) : (init?.body ?? null),
    });
  } catch {
    throw new ClientError("NETWORK", "Could not reach the server", 0);
  }
  const body = await res.json().catch(() => null);
  if (!body?.ok) {
    const issue = body?.error?.issues?.[0]?.message;
    throw new ClientError(body?.error?.code ?? "UNKNOWN", issue ?? body?.error?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body.data as T;
}

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
export type IncidentRow = {
  id: string; ref: string; title: string; source_type: string; status: string;
  risk_score: number | null; risk_level: string | null; confidence: string | null; is_demo: boolean; created_at: string;
};
export type ScoreBreakdown = {
  score: number; level: string; confidence: string; missing: string[]; conflicts: string[]; explanation: string; model: string;
  applied: { key: string; label: string; points: number; reason: string; evidence: string[] }[];
};
export type AgentRun = {
  id: string; agent_type: string; status: string; started_at: string | null; completed_at: string | null;
  summary: string | null; output_json: Record<string, unknown> | null; error_code: string | null; attempt_number: number;
};
export type Evidence = { id: string; agent_run_id: string | null; evidence_type: string; summary: string; source: string; observed_at: string; confidence: string; metadata_json: Record<string, unknown> };
export type Recommendation = { id: string; incident_id: string; action_type: string; title: string; rationale: string; status: string; simulated_result: string | null; created_at: string; approvals?: { decision: string; note: string | null; decided_at: string }[] };
export type AuditEvent = { id: string; incident_id: string | null; actor_id: string; event_type: string; details_json: Record<string, unknown>; created_at: string; incidents?: { ref: string; title?: string } | null };
export type IncidentDetail = {
  incident: IncidentRow & { raw_content: string; score_breakdown: ScoreBreakdown | null; updated_at: string };
  indicators: { id: string; indicator_type: string; indicator_value: string; normalized_value: string }[];
  agentRuns: AgentRun[]; evidence: Evidence[]; recommendations: Recommendation[]; audit: AuditEvent[];
};
