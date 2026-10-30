import { z } from "zod";
import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { aiObject, untrusted, AiError } from "./ai.server";
import {
  extractIndicators, parseEmail, findKeywords, urlPatternFlags, lookalikeBrand,
  mentionedBrands, BRANDS, registrable,
} from "./extract";
import { computeScore, computeConfidence, type Signal, type ScoringRule } from "./scoring";

export const DEMO_ANALYST_ID = "00000000-0000-0000-0000-000000000001";
export const AGENT_ORDER = ["triage", "investigation", "risk_review", "response"] as const;
type AgentType = (typeof AGENT_ORDER)[number];
const MAX_ATTEMPTS = 2;
const AGENT_TIMEOUT_MS = 90_000;

type Incident = { id: string; title: string; source_type: string; raw_content: string };
type EvidenceIn = { evidence_type: string; summary: string; source: string; confidence: string; metadata_json?: Record<string, unknown> };
type AgentResult = { summary: string; output: Record<string, unknown>; evidence: EvidenceIn[] };
type Ctx = Partial<Record<AgentType, Record<string, unknown>>>;

export async function audit(incident_id: string | null, actor_id: string, event_type: string, details: Record<string, unknown> = {}) {
  await db.from("audit_events").insert({ incident_id, actor_id, event_type, details_json: details as never });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new AiError("AGENT_TIMEOUT", "Agent timed out")), ms))]);
}

// ---------------- AGENT 1: TRIAGE ----------------
async function triageAgent(inc: Incident): Promise<AgentResult> {
  const text = inc.raw_content;
  const indicators = extractIndicators(text, inc.source_type);
  const email = inc.source_type === "url" ? null : parseEmail(text);
  const kw = findKeywords(text);
  const brands = mentionedBrands(text);
  const evidence: EvidenceIn[] = [];
  if (kw.urgency.length) evidence.push({ evidence_type: "urgency_language", summary: `Urgency phrases: ${kw.urgency.join(", ")}`, source: "Deterministic keyword rules", confidence: "high", metadata_json: { phrases: kw.urgency } });
  if (kw.credential.length) evidence.push({ evidence_type: "credential_language", summary: `Credential-related phrases: ${kw.credential.join(", ")}`, source: "Deterministic keyword rules", confidence: "high", metadata_json: { phrases: kw.credential } });
  if (kw.injection.length) evidence.push({ evidence_type: "prompt_injection_attempt", summary: `Content contains instructions aimed at automated analysis: ${kw.injection.join(", ")}. Ignored and flagged.`, source: "Deterministic keyword rules", confidence: "high" });
  if (email?.senderDomain && brands.length) {
    const mismatched = brands.filter((b) => !(BRANDS[b] ?? []).includes(registrable(email.senderDomain!)));
    if (mismatched.length) evidence.push({ evidence_type: "impersonation", summary: `Message references ${mismatched.join(", ")} but was sent from ${email.senderDomain}`, source: "Deterministic sender/brand comparison", confidence: "high", metadata_json: { brands: mismatched, sender_domain: email.senderDomain } });
  }

  let ai: { summary: string; tactics: string[] } | null = null;
  let aiError: string | null = null;
  try {
    ai = await aiObject({
      instructions: "Act as the TRIAGE agent. Summarise the submission in 2-3 sentences and list up to 5 social-engineering tactics actually present (short phrases). If none, return an empty list.",
      messages: [{ role: "user", content: `Source type: ${inc.source_type}\n${untrusted(text)}` }],
      schema: z.object({ summary: z.string(), tactics: z.array(z.string()) }),
    });
  } catch (e) {
    aiError = (e as AiError).code ?? "AI_ERROR";
  }
  const det = `Extracted ${indicators.length} indicators (${indicators.filter((i) => i.type === "url").length} URLs, ${indicators.filter((i) => i.type === "domain").length} domains). ${kw.urgency.length + kw.credential.length} pressure/credential phrases.`;
  return {
    summary: ai ? ai.summary : `${det} (AI summary unavailable: ${aiError}; deterministic summary shown.)`,
    output: { indicators, email, keywords: kw, brands, ai_tactics: ai?.tactics.slice(0, 5) ?? [], ai_used: !!ai, ai_error: aiError, deterministic_summary: det },
    evidence,
  };
}

// ---------------- AGENT 2: INVESTIGATION ----------------
async function investigationAgent(inc: Incident, ctx: Ctx): Promise<AgentResult> {
  const t = ctx.triage as { indicators: { type: string; normalized: string; value: string }[]; email: ReturnType<typeof parseEmail> | null };
  const domains = [...new Set(t.indicators.filter((i) => i.type === "domain").map((i) => i.normalized))];
  const urls = t.indicators.filter((i) => i.type === "url").map((i) => i.value);
  const senderEmail = t.email?.senderEmail ?? null;
  const lookups = [...domains, ...domains.map(registrable), ...(senderEmail ? [senderEmail] : [])];
  const { data: fixtures, error: fe } = await db.from("threat_fixtures").select("*").in("value", lookups.length ? lookups : ["-"]);
  if (fe) throw new AiError("DB_ERROR", fe.message);
  const { data: logs, error: le } = await db.from("security_logs").select("*").in("indicator", lookups.length ? lookups : ["-"]);
  if (le) throw new AiError("DB_ERROR", le.message);

  const evidence: EvidenceIn[] = [];
  const reputation: Record<string, string> = {};
  for (const d of domains) {
    const f = fixtures?.find((x) => x.value === d) ?? fixtures?.find((x) => x.value === registrable(d));
    if (f) {
      reputation[d] = f.verdict;
      evidence.push({ evidence_type: `reputation_${f.verdict}`, summary: `${d}: ${f.verdict.toUpperCase()} — ${f.note ?? ""}`, source: f.source, confidence: "high", metadata_json: { domain: d, verdict: f.verdict, synthetic: true } });
    } else {
      reputation[d] = "unknown";
      evidence.push({ evidence_type: "reputation_unavailable", summary: `${d}: no reputation data available. Treated as UNKNOWN, not safe.`, source: "Synthetic Reputation Fixture", confidence: "low", metadata_json: { domain: d } });
    }
  }
  const senderFixture = senderEmail ? fixtures?.find((x) => x.value === senderEmail) : null;
  if (senderFixture) evidence.push({ evidence_type: `sender_${senderFixture.verdict}`, summary: `Sender ${senderEmail} is ${senderFixture.verdict} — ${senderFixture.note ?? ""}`, source: senderFixture.source, confidence: "high", metadata_json: { synthetic: true } });
  for (const l of logs ?? []) {
    evidence.push({ evidence_type: "security_log", summary: `[${l.severity.toUpperCase()}] ${l.indicator}: ${l.message}`, source: l.log_source, confidence: l.severity === "low" ? "medium" : "high", metadata_json: { severity: l.severity, synthetic: true } });
  }
  const urlFlags: Record<string, string[]> = {};
  for (const u of urls) {
    const f = urlPatternFlags(u);
    urlFlags[u] = f;
    if (f.length) evidence.push({ evidence_type: "deceptive_url", summary: `${u.slice(0, 120)} → ${f.join(", ")}`, source: "Deterministic URL pattern checks (URL not opened)", confidence: "high", metadata_json: { flags: f } });
  }
  const senderLookalike = t.email?.senderDomain ? lookalikeBrand(t.email.senderDomain) : null;
  if (senderLookalike) evidence.push({ evidence_type: "lookalike_sender", summary: `Sender domain ${t.email!.senderDomain} imitates ${senderLookalike}`, source: "Deterministic lookalike check", confidence: "high" });

  let aiSummary: string | null = null;
  let aiError: string | null = null;
  try {
    const r = await aiObject({
      instructions: "Act as the INVESTIGATION agent. Given the structured findings (already collected by tools), write a 2-3 sentence investigation summary. Only reference findings provided.",
      messages: [{ role: "user", content: JSON.stringify({ reputation, url_flags: urlFlags, logs: logs?.map((l) => l.message), sender_lookalike: senderLookalike }) }],
      schema: z.object({ summary: z.string() }),
    });
    aiSummary = r.summary;
  } catch (e) {
    aiError = (e as AiError).code ?? "AI_ERROR";
  }
  const det = `Checked ${domains.length} domain(s) against reputation fixtures (${Object.values(reputation).filter((v) => v !== "unknown").length} with data), ${logs?.length ?? 0} matching synthetic log(s), ${urls.length} URL(s) pattern-checked without fetching.`;
  return {
    summary: aiSummary ?? `${det} (AI summary unavailable: ${aiError}.)`,
    output: { reputation, url_flags: urlFlags, logs: logs ?? [], sender_verdict: senderFixture?.verdict ?? null, sender_lookalike: senderLookalike, ai_used: !!aiSummary, ai_error: aiError, deterministic_summary: det },
    evidence,
  };
}

// ---------------- AGENT 3: RISK REVIEWER ----------------
async function riskReviewAgent(inc: Incident, ctx: Ctx): Promise<AgentResult> {
  const tri = ctx.triage as { keywords: { urgency: string[]; credential: string[] }; email: ReturnType<typeof parseEmail> | null; brands: string[]; ai_used: boolean };
  const inv = ctx.investigation as { reputation: Record<string, string>; url_flags: Record<string, string[]>; logs: { severity: string; message: string; indicator: string }[]; sender_verdict: string | null; sender_lookalike: string | null; ai_used: boolean };
  const { data: rules, error } = await db.from("scoring_rules").select("*");
  if (error) throw new AiError("DB_ERROR", error.message);

  const signals: Signal[] = [];
  const rep = Object.entries(inv.reputation);
  const mal = rep.filter(([, v]) => v === "malicious").map(([d]) => d);
  const sus = rep.filter(([, v]) => v === "suspicious").map(([d]) => d);
  const unknown = rep.filter(([, v]) => v === "unknown").map(([d]) => d);
  if (mal.length) signals.push({ key: "known_malicious", reason: `Reputation fixture marks ${mal.join(", ")} as malicious`, evidence: mal });
  if (sus.length) signals.push({ key: "suspicious_reputation", reason: `Reputation fixture marks ${sus.join(", ")} as suspicious`, evidence: sus });
  const senderDomain = tri.email?.senderDomain;
  const brandMismatch = senderDomain ? tri.brands.filter((b) => !(BRANDS[b] ?? []).includes(registrable(senderDomain))) : [];
  if (inv.sender_lookalike || brandMismatch.length)
    signals.push({ key: "sender_mismatch", reason: inv.sender_lookalike ? `Sender domain ${senderDomain} imitates ${inv.sender_lookalike}` : `References ${brandMismatch.join(", ")} but sent from ${senderDomain}`, evidence: [senderDomain ?? ""] });
  const pressure = [...tri.keywords.urgency, ...tri.keywords.credential];
  if (pressure.length) signals.push({ key: "pressure_language", reason: `Pressure/credential phrases: ${pressure.slice(0, 5).join(", ")}`, evidence: pressure });
  const flagged = Object.entries(inv.url_flags).filter(([, f]) => f.length);
  if (flagged.length) signals.push({ key: "deceptive_url", reason: `Deceptive URL patterns: ${[...new Set(flagged.flatMap(([, f]) => f))].join(", ")}`, evidence: flagged.map(([u]) => u) });
  const strongLogs = inv.logs.filter((l) => l.severity !== "low");
  if (strongLogs.length) signals.push({ key: "corroborating_log", reason: `${strongLogs.length} corroborating synthetic security log(s)`, evidence: strongLogs.map((l) => l.message) });
  const spfWeak = inv.logs.some((l) => /spf result: (none|fail|softfail)/i.test(l.message));
  if (inc.source_type !== "url" && inv.sender_verdict !== "benign" && (spfWeak || !senderDomain))
    signals.push({ key: "unverified_sender", reason: spfWeak ? "Sender authentication (SPF) incomplete in synthetic mail log" : "Sender could not be identified", evidence: [] });
  const allBenign = rep.length > 0 && rep.every(([, v]) => v === "benign") && (inc.source_type === "url" || inv.sender_verdict === "benign");
  if (allBenign) signals.push({ key: "benign_allowlisted", reason: "Sender and all domains match verified benign allowlist fixtures", evidence: rep.map(([d]) => d) });

  const result = computeScore(signals, rules as ScoringRule[]);
  const missing: string[] = [];
  unknown.forEach((d) => missing.push(`No reputation data for ${d} (treated as unknown, not safe)`));
  if (inc.source_type !== "url" && !senderDomain) missing.push("Sender address could not be extracted");
  if (inc.source_type !== "url" && !inv.sender_verdict) missing.push("Sender not verified against allowlist");
  if (!rep.length) missing.push("No domains or URLs found to investigate");
  if (!tri.ai_used || !inv.ai_used) missing.push("AI narrative summaries unavailable for one or more agents (deterministic results used)");
  const conflicts: string[] = [];
  if (allBenign && pressure.length) conflicts.push("Allowlisted sender but message contains pressure/credential language");
  if (inv.sender_verdict === "benign" && (mal.length || sus.length)) conflicts.push("Benign sender but links point to malicious/suspicious domains");
  const confidence = computeConfidence({
    domainsTotal: rep.length, domainsWithReputation: rep.length - unknown.length,
    senderKnown: !!inv.sender_verdict || !!inv.sender_lookalike, conflicts: conflicts.length,
    aiAvailable: tri.ai_used && inv.ai_used, sourceType: inc.source_type,
  });

  let explanation: string | null = null;
  let aiError: string | null = null;
  try {
    const r = await aiObject({
      instructions: "Act as the RISK REVIEWER agent. The score was computed by deterministic backend rules — do NOT change or re-estimate it. Explain in 2-4 sentences why the incident received this score and level, citing the applied rules, missing evidence and conflicts.",
      messages: [{ role: "user", content: JSON.stringify({ score: result.score, level: result.level, confidence, applied: result.applied.map((a) => ({ rule: a.label, points: a.points, reason: a.reason })), missing, conflicts }) }],
      schema: z.object({ explanation: z.string() }),
    });
    explanation = r.explanation;
  } catch (e) {
    aiError = (e as AiError).code ?? "AI_ERROR";
  }
  const det = `Score ${result.score}/100 (${result.level}) from ${result.applied.length} rule(s): ${result.applied.map((a) => `${a.label} ${a.points > 0 ? "+" : ""}${a.points}`).join("; ") || "none"}. Confidence ${confidence}.`;
  const breakdown = { ...result, confidence, missing, conflicts, explanation: explanation ?? det, model: "PhishPilot prototype scoring model v1 (not a certified standard)" };
  await db.from("incidents").update({ risk_score: result.score, risk_level: result.level, confidence, score_breakdown: breakdown as never }).eq("id", inc.id);
  return {
    summary: explanation ?? `${det} (AI explanation unavailable: ${aiError}.)`,
    output: { ...breakdown, ai_used: !!explanation, ai_error: aiError },
    evidence: [
      ...missing.map((m) => ({ evidence_type: "missing_evidence", summary: m, source: "Risk Reviewer cross-check", confidence: "high" })),
      ...conflicts.map((c) => ({ evidence_type: "conflict", summary: c, source: "Risk Reviewer cross-check", confidence: "medium" })),
    ],
  };
}

// ---------------- AGENT 4: RESPONSE ----------------
const PLAYBOOK: Record<string, { action_type: string; title: string; why: string }[]> = {
  HIGH: [
    { action_type: "block_domain_request", title: "Request domain block via existing security process", why: "Malicious or deceptive domains were identified; blocking prevents further clicks." },
    { action_type: "notify_users", title: "Notify potentially affected users", why: "High-risk lures may have reached other recipients; users should not interact and should reset credentials if they did." },
    { action_type: "report_sender", title: "Report sender to mail provider / abuse contact", why: "Sender impersonation or lookalike domain detected." },
  ],
  MEDIUM: [
    { action_type: "further_investigation", title: "Mark incident for further investigation", why: "Evidence is suggestive but incomplete; an analyst should verify before acting." },
    { action_type: "report_sender", title: "Recommend reporting the sender", why: "Sender could not be verified." },
  ],
  LOW: [
    { action_type: "close_benign", title: "Close as benign and inform reporter", why: "Evidence indicates a known benign or allowlisted message." },
  ],
};
async function responseAgent(inc: Incident, ctx: Ctx): Promise<AgentResult> {
  const risk = ctx.risk_review as { level: string; score: number; applied: { label: string; reason: string }[]; missing: string[] };
  const plays = PLAYBOOK[risk.level] ?? PLAYBOOK["MEDIUM"] ?? [];
  const recs = plays.map((p) => ({
    action_type: p.action_type, title: p.title,
    rationale: `${p.why} Basis: risk ${risk.score}/100 (${risk.level}). ${risk.applied.slice(0, 3).map((a) => a.reason).join(". ")}${risk.missing.length ? `. Missing: ${risk.missing[0]}` : ""}.`,
  }));
  await db.from("recommendations").update({ status: "superseded" }).eq("incident_id", inc.id).eq("status", "pending");
  const { error } = await db.from("recommendations").insert(recs.map((r) => ({ ...r, incident_id: inc.id, status: "pending" })));
  if (error) throw new AiError("DB_ERROR", error.message);
  let aiError: string | null = null;
  let brief: string | null = null;
  try {
    const r = await aiObject({
      instructions: "Act as the RESPONSE agent. In 2 sentences, brief the analyst on the proposed actions. Stress these require human approval and are simulated.",
      messages: [{ role: "user", content: JSON.stringify({ level: risk.level, actions: recs.map((r) => r.title) }) }],
      schema: z.object({ brief: z.string() }),
    });
    brief = r.brief;
  } catch (e) {
    aiError = (e as AiError).code ?? "AI_ERROR";
  }
  return {
    summary: brief ?? `Prepared ${recs.length} recommendation(s) for ${risk.level} risk, pending human approval. (AI brief unavailable: ${aiError}.)`,
    output: { recommendations: recs, ai_used: !!brief, ai_error: aiError },
    evidence: [],
  };
}

const AGENTS: Record<AgentType, (inc: Incident, ctx: Ctx) => Promise<AgentResult>> = {
  triage: (i) => triageAgent(i), investigation: investigationAgent, risk_review: riskReviewAgent, response: responseAgent,
};

// ---------------- ORCHESTRATOR ----------------
export async function runWorkflow(incidentId: string, opts: { force?: boolean } = {}) {
  const { data: inc, error } = await db.from("incidents").select("*").eq("id", incidentId).maybeSingle();
  if (error) throw new AiError("DB_ERROR", error.message);
  if (!inc) throw new AiError("NOT_FOUND", "Incident not found");

  // Acquire lock (prevents duplicate execution). Stale locks (>5 min) can be taken over.
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: locked } = await db.from("incidents").update({ status: "analyzing" })
    .eq("id", incidentId).or(`status.neq.analyzing,updated_at.lt.${staleBefore}`).select("id");
  if (!locked?.length) throw new AiError("ALREADY_RUNNING", "Investigation already in progress");

  const { data: prevRuns } = await db.from("agent_runs").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true });
  const latest = new Map<string, NonNullable<typeof prevRuns>[number]>();
  (prevRuns ?? []).forEach((r) => latest.set(r.agent_type, r));
  const allDone = AGENT_ORDER.every((a) => latest.get(a)?.status === "completed");
  if (allDone && !opts.force) {
    await db.from("incidents").update({ status: inc.status === "analyzing" ? "awaiting_approval" : inc.status }).eq("id", incidentId);
    throw new AiError("ALREADY_COMPLETE", "Investigation already completed; use force to re-run");
  }
  const fresh = !!opts.force;
  if (fresh && prevRuns?.length) {
    await db.from("indicators").delete().eq("incident_id", incidentId);
    await db.from("evidence").delete().eq("incident_id", incidentId);
  }
  await audit(incidentId, "system:orchestrator", fresh && prevRuns?.length ? "workflow_restarted" : prevRuns?.length ? "workflow_retry" : "workflow_started", { reused: fresh ? [] : AGENT_ORDER.filter((a) => latest.get(a)?.status === "completed") });

  // Create queued tasks for agents that need to run.
  const ctx: Ctx = {};
  const runIds: Partial<Record<AgentType, string>> = {};
  for (const a of AGENT_ORDER) {
    const prev = latest.get(a);
    if (!fresh && prev?.status === "completed") { ctx[a] = prev.output_json as Record<string, unknown>; continue; }
    const { data: run } = await db.from("agent_runs").insert({ incident_id: incidentId, agent_type: a, status: "queued", attempt_number: (prev?.attempt_number ?? 0) + 1 }).select("id").single();
    runIds[a] = run!.id;
  }

  let failedAgent: AgentType | null = null;
  for (const a of AGENT_ORDER) {
    const runId = runIds[a];
    if (!runId) continue;
    if (failedAgent) {
      await db.from("agent_runs").update({ status: "failed", error_code: "DEPENDENCY_FAILED", summary: `Skipped: depends on ${failedAgent}` }).eq("id", runId);
      continue;
    }
    let attempt = 0;
    let done = false;
    let currentRun = runId;
    while (!done && attempt < MAX_ATTEMPTS) {
      attempt++;
      if (attempt > 1) {
        const { data: r } = await db.from("agent_runs").select("attempt_number").eq("id", currentRun).single();
        const { data: nr } = await db.from("agent_runs").insert({ incident_id: incidentId, agent_type: a, status: "queued", attempt_number: (r?.attempt_number ?? 1) + 1 }).select("id").single();
        currentRun = nr!.id;
      }
      const started = new Date().toISOString();
      await db.from("agent_runs").update({ status: "running", started_at: started }).eq("id", currentRun);
      await audit(incidentId, `agent:${a}`, "agent_started", { attempt });
      try {
        const res = await withTimeout(AGENTS[a](inc as Incident, ctx), AGENT_TIMEOUT_MS);
        if (a === "triage") {
          const inds = (res.output["indicators"] as { type: string; value: string; normalized: string }[]) ?? [];
          if (inds.length) await db.from("indicators").insert(inds.map((i) => ({ incident_id: incidentId, indicator_type: i.type, indicator_value: i.value, normalized_value: i.normalized })));
        }
        if (res.evidence.length) await db.from("evidence").insert(res.evidence.map((e) => ({ ...e, metadata_json: (e.metadata_json ?? {}) as never, incident_id: incidentId, agent_run_id: currentRun })));
        await db.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString(), summary: res.summary, output_json: res.output as never, error_code: null }).eq("id", currentRun);
        ctx[a] = res.output;
        await audit(incidentId, `agent:${a}`, "agent_completed", { evidence_count: res.evidence.length, ai_used: res.output["ai_used"] });
        done = true;
      } catch (e) {
        const code = (e as AiError).code ?? "AGENT_ERROR";
        console.error(`[orchestrator] ${a} failed`, e);
        await db.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_code: code, summary: `Failed: ${(e as Error).message?.slice(0, 200)}` }).eq("id", currentRun);
        await audit(incidentId, `agent:${a}`, "agent_failed", { code, attempt });
      }
    }
    if (!done) failedAgent = a;
  }
  const status = failedAgent ? "partial" : "awaiting_approval";
  await db.from("incidents").update({ status }).eq("id", incidentId);
  await audit(incidentId, "system:orchestrator", failedAgent ? "workflow_partial" : "workflow_completed", { failed_agent: failedAgent });
  return { status, failedAgent };
}
