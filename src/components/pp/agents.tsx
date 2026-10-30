import { useState } from "react";
import { ChevronDown, ScanSearch, Microscope, Scale, ShieldCheck, Check, X, Loader2, Circle } from "lucide-react";
import type { AgentRun, Evidence } from "@/lib/pp/client";
import { StatusBadge, Tag, duration } from "./bits";
import { cn } from "@/lib/utils";

export const AGENTS = [
  { type: "triage", name: "Triage Agent", icon: ScanSearch, resp: "Extracts sender, subject, URLs, domains, urgency and impersonation indicators." },
  { type: "investigation", name: "Investigation Agent", icon: Microscope, resp: "Checks domains against reputation fixtures and synthetic logs; inspects URL patterns without opening them." },
  { type: "risk_review", name: "Risk Reviewer", icon: Scale, resp: "Cross-checks evidence, finds gaps and conflicts, applies backend scoring rules." },
  { type: "response", name: "Response Agent", icon: ShieldCheck, resp: "Prepares recommended actions and submits them for human approval." },
] as const;

export function latestRuns(runs: AgentRun[]) {
  return AGENTS.map((a) => ({ meta: a, run: [...runs].reverse().find((r) => r.agent_type === a.type) ?? null, attempts: runs.filter((r) => r.agent_type === a.type).length }));
}

export function WorkflowTracker({ runs, incidentStatus }: { runs: AgentRun[]; incidentStatus: string }) {
  const steps = [
    { label: "Submitted", state: "completed" },
    ...latestRuns(runs).map(({ meta, run }) => ({ label: meta.name.replace(" Agent", ""), state: run?.status ?? "not_started" })),
    { label: "Human approval", state: incidentStatus === "resolved" ? "completed" : incidentStatus === "awaiting_approval" ? "running" : "not_started" },
  ];
  return (
    <ol className="flex items-start gap-0 overflow-x-auto pb-1">
      {steps.map((s, i) => (
        <li key={s.label} className="flex min-w-[78px] flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <div className={cn("h-px flex-1", i === 0 ? "bg-transparent" : "bg-border")} />
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
              s.state === "completed" && "border-risk-low bg-risk-low-bg text-risk-low",
              s.state === "running" && "border-info bg-info-bg text-info",
              s.state === "failed" && "border-risk-high bg-risk-high-bg text-risk-high",
              (s.state === "queued" || s.state === "not_started") && "border-border bg-card text-muted-foreground")}>
              {s.state === "completed" ? <Check className="size-3.5" /> : s.state === "failed" ? <X className="size-3.5" /> : s.state === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Circle className="size-2" />}
            </span>
            <div className={cn("h-px flex-1", i === steps.length - 1 ? "bg-transparent" : "bg-border")} />
          </div>
          <span className="mt-1.5 text-[11px] font-medium leading-tight text-muted-foreground">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function AgentCards({ runs, evidence }: { runs: AgentRun[]; evidence: Evidence[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {latestRuns(runs).map(({ meta, run, attempts }) => (
        <AgentCard key={meta.type} meta={meta} run={run} attempts={attempts} evidence={evidence.filter((e) => run && e.agent_run_id === run.id)} />
      ))}
    </div>
  );
}

function AgentCard({ meta, run, attempts, evidence }: { meta: (typeof AGENTS)[number]; run: AgentRun | null; attempts: number; evidence: Evidence[] }) {
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;
  const out = run?.output_json ?? {};
  const aiUsed = out.ai_used as boolean | undefined;
  return (
    <div className="card-surface flex flex-col">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-4 text-left" aria-expanded={open}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-navy text-brand"><Icon className="size-4.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{meta.name}</span>
            <StatusBadge status={run?.status ?? "not_started"} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{meta.resp}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
            {run && <span>attempt {run.attempt_number}{attempts > 1 ? ` (${attempts} runs)` : ""}</span>}
            {duration(run?.started_at ?? null, run?.completed_at ?? null) && <span>⏱ {duration(run!.started_at, run!.completed_at)}</span>}
            {run?.status === "completed" && <span>{evidence.length} evidence</span>}
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {run?.summary && <p className="border-t px-4 py-3 text-sm leading-relaxed">{run.summary}</p>}
      {run?.error_code && <p className="mx-4 mb-3 rounded bg-risk-high-bg px-2 py-1 font-mono text-xs text-risk-high">Error: {run.error_code}</p>}
      {open && run && (
        <div className="space-y-3 border-t bg-muted/40 px-4 py-3 text-xs">
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="info">Deterministic rules</Tag>
            {aiUsed ? <Tag tone="brand">AI narrative</Tag> : <Tag>AI unavailable — {String(out.ai_error ?? "n/a")}</Tag>}
          </div>
          {typeof out.deterministic_summary === "string" && <p><span className="label-caps">Deterministic result </span><br />{out.deterministic_summary}</p>}
          {Array.isArray(out.ai_tactics) && out.ai_tactics.length > 0 && (
            <div><div className="label-caps mb-1">AI-identified tactics</div><ul className="list-disc pl-4">{(out.ai_tactics as string[]).map((t) => <li key={t}>{t}</li>)}</ul></div>
          )}
          {evidence.length > 0 && (
            <div><div className="label-caps mb-1">Findings</div>
              <ul className="space-y-1.5">{evidence.map((e) => (
                <li key={e.id} className="rounded border bg-card p-2"><span className="font-mono text-[10px] text-muted-foreground">{e.evidence_type}</span><div>{e.summary}</div><div className="text-[10px] text-muted-foreground">Source: {e.source}</div></li>
              ))}</ul>
            </div>
          )}
          <details><summary className="cursor-pointer text-muted-foreground">Raw structured output</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-navy p-2 font-mono text-[10px] text-navy-foreground">{JSON.stringify(out, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
