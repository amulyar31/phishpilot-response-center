import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpDown, Search } from "lucide-react";
import { api, type IncidentRow } from "@/lib/pp/client";
import { PageHeader, RiskBadge, StatusBadge, ErrorBox, Loading, fmtDate, Tag } from "@/components/pp/bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/incidents/")({
  head: () => ({
    meta: [
      { title: "Incidents — PhishPilot" },
      { name: "description", content: "Search, filter and sort reported phishing incidents." },
      { property: "og:title", content: "Incidents — PhishPilot" },
      { property: "og:description", content: "Search, filter and sort reported phishing incidents." },
    ],
  }),
  component: Incidents,
});

type List = { items: IncidentRow[]; total: number; page: number; pageSize: number };

function Incidents() {
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState<"created_at" | "risk_score" | "title">("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "10", sort, dir, ...(q && { q }), ...(risk !== "all" && { risk }), ...(status !== "all" && { status }), ...(source !== "all" && { source }) });
  const list = useQuery({ queryKey: ["incidents", params.toString()], queryFn: () => api<List>(`/api/incidents?${params}`), placeholderData: keepPreviousData, refetchInterval: 10000 });
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const toggleSort = (k: typeof sort) => { if (sort === k) setDir(dir === "asc" ? "desc" : "asc"); else { setSort(k); setDir("desc"); } setPage(1); };
  const reset = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader title="Incidents" subtitle={list.data ? `${list.data.total} incident(s) in the database` : undefined}
        actions={<Button variant="brand" asChild><Link to="/submit">Report incident</Link></Button>} />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="bg-card pl-8" placeholder="Search subject or incident ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Filter value={risk} onChange={reset(setRisk)} label="Risk" opts={[["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"], ["UNSCORED", "Unscored"]]} />
        <Filter value={status} onChange={reset(setStatus)} label="Status" opts={[["submitted", "Submitted"], ["analyzing", "Investigating"], ["awaiting_approval", "Awaiting approval"], ["partial", "Partial"], ["resolved", "Resolved"]]} />
        <Filter value={source} onChange={reset(setSource)} label="Source" opts={[["email", "Email"], ["url", "URL"], ["screenshot", "Screenshot"]]} />
      </div>
      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/60 text-left">
              <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:label-caps">
                <th>Incident ID</th>
                <th><button className="inline-flex items-center gap-1" onClick={() => toggleSort("title")}>Subject <ArrowUpDown className="size-3" /></button></th>
                <th>Source</th>
                <th><button className="inline-flex items-center gap-1" onClick={() => toggleSort("risk_score")}>Risk <ArrowUpDown className="size-3" /></button></th>
                <th>Status</th>
                <th><button className="inline-flex items-center gap-1" onClick={() => toggleSort("created_at")}>Submitted <ArrowUpDown className="size-3" /></button></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data!.items.map((i) => (
                <tr key={i.id} className="hover:bg-muted/40 [&>td]:px-4 [&>td]:py-3">
                  <td className="font-mono text-xs"><Link to="/incidents/$id" params={{ id: i.id }} className="text-accent-foreground hover:underline">{i.ref}</Link></td>
                  <td className="max-w-xs"><Link to="/incidents/$id" params={{ id: i.id }} className="line-clamp-1 font-medium hover:underline">{i.title}</Link>{i.is_demo && <Tag>Demo data</Tag>}</td>
                  <td className="capitalize text-muted-foreground">{i.source_type}</td>
                  <td><RiskBadge level={i.risk_level} score={i.risk_score} /></td>
                  <td><StatusBadge status={i.status} /></td>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(i.created_at)}</td>
                </tr>
              ))}
              {list.data!.items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No incidents match these filters.</td></tr>}
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

function Filter({ value, onChange, label, opts }: { value: string; onChange: (v: string) => void; label: string; opts: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-card" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
