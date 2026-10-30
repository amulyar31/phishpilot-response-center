import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Play } from "lucide-react";
import { toast } from "sonner";
import { api, type IncidentDetail } from "@/lib/pp/client";
import { PageHeader, Panel, RiskBadge, StatusBadge, ErrorBox, Loading, fmtDate, Tag } from "@/components/pp/bits";
import { AgentCards, WorkflowTracker } from "@/components/pp/agents";
import { RecommendationItem } from "@/components/pp/decision";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/incidents/$id")({
  head: () => ({
    meta: [
      { title: "Incident investigation — PhishPilot" },
      { name: "description", content: "Risk score, evidence, agent findings and recommendations for a phishing incident." },
      { property: "og:title", content: "Incident investigation — PhishPilot" },
      { property: "og:description", content: "Risk score, evidence, agent findings and recommendations for a phishing incident." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api<IncidentDetail>(`/api/incidents/${id}`),
    refetchInterval: (query) => (query.state.data?.incident.status === "analyzing" ? 1500 : 10000),
  });
  const run = useMutation({
    mutationFn: (force: boolean) => {
      const p = api(`/api/incidents/${id}/analyze`, { method: "POST", json: { force } });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["incident", id] }), 600);
      return p;
    },
    onSuccess: () => { toast.success("Investigation finished"); qc.invalidateQueries(); },
    onError: (e) => { toast.error((e as Error).message); qc.invalidateQueries(); },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  const inc = d.incident;
  const b = inc.score_breakdown;
  const running = inc.status === "analyzing" || run.isPending;

  return (
    <>
      <Link to="/incidents" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3" />Incidents</Link>
      <PageHeader title={inc.title}
        subtitle={`${inc.ref} · ${inc.source_type} · submitted ${fmtDate(inc.created_at)}`}
        actions={<>
          {inc.is_demo && <Tag>Demo data</Tag>}
          <StatusBadge status={inc.status} />
          {inc.status === "submitted" && <Button size="sm" variant="brand" disabled={running} onClick={() => run.mutate(false)}><Play className="size-3.5" />Start investigation</Button>}
          {inc.status === "partial" && <Button size="sm" variant="brand" disabled={running} onClick={() => run.mutate(false)}><RotateCcw className="size-3.5" />Retry failed agents</Button>}
          {["awaiting_approval", "resolved"].includes(inc.status) && <Button size="sm" variant="outline" disabled={running} onClick={() => run.mutate(true)}><RotateCcw className="size-3.5" />Re-run all</Button>}
        </>} />

      <Panel className="mb-5"><WorkflowTracker runs={d.agentRuns} incidentStatus={inc.status} /></Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Risk assessment" right={<Tag>Prototype model</Tag>}>
          {b ? (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <span className="font-mono text-4xl font-semibold">{b.score}</span>
                <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
                <span className="ml-auto pb-1"><RiskBadge level={b.level} /></span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${b.level === "HIGH" ? "bg-risk-high" : b.level === "MEDIUM" ? "bg-risk-medium" : "bg-risk-low"}`} style={{ width: `${b.score}%` }} /></div>
              <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"><span className="label-caps">Confidence</span><span className="font-semibold">{b.confidence}</span></div>
              <div>
                <div className="label-caps mb-1.5">Score breakdown (backend rules)</div>
                <ul className="space-y-1.5 text-xs">
                  {b.applied.map((a) => (
                    <li key={a.key} className="flex gap-2"><span className={`w-9 shrink-0 font-mono font-semibold ${a.points < 0 ? "text-risk-low" : "text-risk-high"}`}>{a.points > 0 ? "+" : ""}{a.points}</span><span><span className="font-medium">{a.label}</span><br /><span className="text-muted-foreground">{a.reason}</span></span></li>
                  ))}
                  {b.applied.length === 0 && <li className="text-muted-foreground">No scoring rules triggered.</li>}
                </ul>
              </div>
              {b.missing.length > 0 && <div><div className="label-caps mb-1">Missing evidence</div><ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">{b.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              {b.conflicts.length > 0 && <div><div className="label-caps mb-1">Conflicts</div><ul className="list-disc pl-4 text-xs text-risk-medium">{b.conflicts.map((m) => <li key={m}>{m}</li>)}</ul></div>}
              <p className="text-[11px] text-muted-foreground">{b.model}. Unavailable reputation is never treated as safe.</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">{running ? "Risk Reviewer has not finished yet…" : "Not scored yet."}</p>}
        </Panel>

        <div className="space-y-5 lg:col-span-2">
          <Panel title="Recommendations" right={<Tag tone="brand">Human approval required</Tag>}>
            {d.recommendations.filter((r) => r.status !== "superseded").length ? (
              <div className="space-y-2">{d.recommendations.filter((r) => r.status !== "superseded").map((r) => <RecommendationItem key={r.id} rec={r} />)}</div>
            ) : <p className="text-sm text-muted-foreground">The Response Agent has not produced recommendations yet.</p>}
          </Panel>
          {b?.explanation && <Panel title="Risk Reviewer explanation"><p className="text-sm leading-relaxed">{b.explanation}</p></Panel>}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Agent activity</h2>
      <AgentCards runs={d.agentRuns} evidence={d.evidence} />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title={`Extracted indicators (${d.indicators.length})`}>
          {d.indicators.length ? (
            <ul className="divide-y text-xs">{d.indicators.map((i) => (
              <li key={i.id} className="flex gap-3 py-1.5"><span className="w-32 shrink-0 font-mono text-muted-foreground">{i.indicator_type}</span><span className="break-all font-mono">{i.indicator_value}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">None yet.</p>}
        </Panel>
        <Panel title={`Evidence (${d.evidence.length})`} right={<Tag>Synthetic sources labelled</Tag>}>
          <ul className="space-y-2 text-xs">{d.evidence.map((e) => (
            <li key={e.id} className="rounded border p-2">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">{e.evidence_type}</span><span className="text-[10px] text-muted-foreground">conf: {e.confidence}</span></div>
              <div className="mt-0.5">{e.summary}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{e.source} · {fmtDate(e.observed_at)}</div>
            </li>
          ))}{d.evidence.length === 0 && <li className="text-sm text-muted-foreground">None yet.</li>}</ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Submitted content (untrusted)">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-3 font-mono text-[11px]">{inc.raw_content}</pre>
        </Panel>
        <Panel title="Audit timeline">
          <ol className="relative space-y-3 border-l pl-4">{d.audit.map((a) => (
            <li key={a.id} className="text-xs">
              <span className="absolute -left-[4.5px] mt-1 size-2 rounded-full bg-brand" />
              <div className="font-medium">{a.event_type.replace(/_/g, " ")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{a.actor_id} · {fmtDate(a.created_at)}</div>
            </li>
          ))}</ol>
        </Panel>
      </div>
    </>
  );
}
