import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api, type AuditEvent } from "@/lib/pp/client";
import { PageHeader, ErrorBox, Loading, fmtDate } from "@/components/pp/bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit logs — PhishPilot" },
      { name: "description", content: "Append-only history of submissions, agent runs and analyst decisions." },
      { property: "og:title", content: "Audit logs — PhishPilot" },
      { property: "og:description", content: "Append-only history of submissions, agent runs and analyst decisions." },
    ],
  }),
  component: Audit,
});

function Audit() {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("all");
  const [page, setPage] = useState(1);
  const p = new URLSearchParams({ page: String(page), ...(q && { q }), ...(actor !== "all" && { actor }) });
  const r = useQuery({ queryKey: ["audit", p.toString()], queryFn: () => api<{ items: AuditEvent[]; total: number }>(`/api/audit?${p}`), placeholderData: keepPreviousData });
  const pages = Math.max(1, Math.ceil((r.data?.total ?? 0) / 25));
  return (
    <>
      <PageHeader title="Audit logs" subtitle={r.data ? `${r.data.total} events · append-only` : undefined} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input className="bg-card sm:max-w-xs" placeholder="Search event type (e.g. approved)" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select value={actor} onValueChange={(v) => { setActor(v); setPage(1); }}>
          <SelectTrigger className="bg-card sm:w-52" aria-label="Actor"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            <SelectItem value="analyst">Analyst</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
            <SelectItem value="system">Orchestrator</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {r.isLoading ? <Loading /> : r.error ? <ErrorBox error={r.error} /> : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/60 text-left"><tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:label-caps"><th>Time</th><th>Incident</th><th>Event</th><th>Actor</th><th>Details</th></tr></thead>
            <tbody className="divide-y">
              {r.data!.items.map((a) => (
                <tr key={a.id} className="align-top [&>td]:px-4 [&>td]:py-2.5">
                  <td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{fmtDate(a.created_at)}</td>
                  <td className="font-mono text-xs">{a.incident_id && a.incidents ? <Link to="/incidents/$id" params={{ id: a.incident_id }} className="text-accent-foreground hover:underline">{a.incidents.ref}</Link> : "—"}</td>
                  <td className="text-xs font-medium">{a.event_type.replace(/_/g, " ")}</td>
                  <td className="font-mono text-xs">{a.actor_id}</td>
                  <td className="max-w-sm break-all font-mono text-[10px] text-muted-foreground">{JSON.stringify(a.details_json)}</td>
                </tr>
              ))}
              {r.data!.items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No events found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page} of {pages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </>
  );
}
