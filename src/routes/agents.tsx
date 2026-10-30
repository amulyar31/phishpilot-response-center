import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type IncidentDetail, type IncidentRow } from "@/lib/pp/client";
import { PageHeader, ErrorBox, Loading, Panel, RiskBadge } from "@/components/pp/bits";
import { AgentCards, WorkflowTracker, AGENTS } from "@/components/pp/agents";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agent activity — PhishPilot" },
      { name: "description", content: "Status, timing and findings of the Triage, Investigation, Risk Reviewer and Response agents." },
      { property: "og:title", content: "Agent activity — PhishPilot" },
      { property: "og:description", content: "Status, timing and findings of the four PhishPilot agents." },
    ],
  }),
  component: Agents,
});

function Agents() {
  const list = useQuery({ queryKey: ["incidents", "agents-picker"], queryFn: () => api<{ items: IncidentRow[] }>("/api/incidents?pageSize=50") });
  const [sel, setSel] = useState<string | null>(null);
  const id = sel ?? list.data?.items[0]?.id ?? null;
  const d = useQuery({
    queryKey: ["incident", id], enabled: !!id,
    queryFn: () => api<IncidentDetail>(`/api/incidents/${id}`),
    refetchInterval: (q) => (q.state.data?.incident.status === "analyzing" ? 1500 : 10000),
  });
  return (
    <>
      <PageHeader title="Agent activity" subtitle="Four specialist agents coordinated by a central orchestrator through a shared incident record." />
      <Panel className="mb-5" title="Pipeline">
        <ol className="grid gap-2 text-xs sm:grid-cols-4">
          {AGENTS.map((a, i) => (
            <li key={a.type} className="rounded-md border bg-muted/50 p-2.5"><span className="font-mono text-brand">{i + 1}.</span> <span className="font-semibold">{a.name}</span><p className="mt-1 text-muted-foreground">{a.resp}</p></li>
          ))}
        </ol>
      </Panel>
      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : !id ? <p className="text-sm text-muted-foreground">No incidents yet.</p> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={id} onValueChange={setSel}>
              <SelectTrigger className="w-full bg-card sm:w-96" aria-label="Incident"><SelectValue /></SelectTrigger>
              <SelectContent>{list.data!.items.map((i) => <SelectItem key={i.id} value={i.id}>{i.ref} — {i.title}</SelectItem>)}</SelectContent>
            </Select>
            {d.data && <><RiskBadge level={d.data.incident.risk_level} score={d.data.incident.risk_score} /><Link to="/incidents/$id" params={{ id }} className="text-xs font-medium text-accent-foreground hover:underline">Open incident</Link></>}
          </div>
          {d.isLoading ? <Loading /> : d.error ? <ErrorBox error={d.error} /> : d.data && (
            <>
              <Panel className="mb-4"><WorkflowTracker runs={d.data.agentRuns} incidentStatus={d.data.incident.status} /></Panel>
              <AgentCards runs={d.data.agentRuns} evidence={d.data.evidence} />
            </>
          )}
        </>
      )}
    </>
  );
}
