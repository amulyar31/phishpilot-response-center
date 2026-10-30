import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FilePlus2 } from "lucide-react";
import { api, type AuditEvent, type IncidentRow } from "@/lib/pp/client";
import { PageHeader, Panel, RiskBadge, StatusBadge, ErrorBox, Loading, fmtDate, Tag } from "@/components/pp/bits";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — PhishPilot" },
      { name: "description", content: "Live phishing incident statistics, risk distribution and recent agent activity." },
      { property: "og:title", content: "Overview — PhishPilot" },
      { property: "og:description", content: "Live phishing incident statistics, risk distribution and recent agent activity." },
    ],
  }),
  component: Overview,
});

type Stats = { total: number; high: number; medium: number; low: number; unscored: number; pending: number; running: number; recent: IncidentRow[]; activity: AuditEvent[] };

function Overview() {
  const q = useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/api/stats"), refetchInterval: 8000 });
  return (
    <>
      <PageHeader title="Security overview" subtitle="All figures are read live from the incident database."
        actions={<Button variant="brand" asChild><Link to="/submit"><FilePlus2 className="size-4" />Report incident</Link></Button>} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : <Body s={q.data!} />}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card-surface p-4">
      <div className="label-caps">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Body({ s }: { s: Stats }) {
  const chart = [
    { name: "High", v: s.high, c: "var(--risk-high)" },
    { name: "Medium", v: s.medium, c: "var(--risk-medium)" },
    { name: "Low", v: s.low, c: "var(--risk-low)" },
    { name: "Unscored", v: s.unscored, c: "var(--chart-4)" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total incidents" value={s.total} />
        <Stat label="High risk" value={s.high} tone="text-risk-high" />
        <Stat label="Medium risk" value={s.medium} tone="text-risk-medium" />
        <Stat label="Low risk" value={s.low} tone="text-risk-low" />
        <Stat label="Pending approvals" value={s.pending} tone="text-accent-foreground" />
        <Stat label="In progress" value={s.running} tone="text-info" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Panel title="Risk distribution" className="lg:col-span-2" right={<Tag>Prototype model</Tag>}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="v" name="Incidents" radius={[4, 4, 0, 0]}>{chart.map((d) => <Cell key={d.name} fill={d.c} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Recent incidents" className="lg:col-span-3" right={<Link to="/incidents" className="text-xs font-medium text-accent-foreground hover:underline">View all</Link>}>
          {s.recent.length === 0 ? <p className="text-sm text-muted-foreground">No incidents yet.</p> : (
            <ul className="-my-2 divide-y">
              {s.recent.map((i) => (
                <li key={i.id}>
                  <Link to="/incidents/$id" params={{ id: i.id }} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.title}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{i.ref} · {fmtDate(i.created_at)}</div>
                    </div>
                    <StatusBadge status={i.status} />
                    <RiskBadge level={i.risk_level} score={i.risk_score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Recent activity" right={<Link to="/audit" className="text-xs font-medium text-accent-foreground hover:underline">Audit log</Link>}>
        <ul className="space-y-2">
          {s.activity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-mono text-[11px] text-muted-foreground">{fmtDate(a.created_at)}</span>
              <span className="font-mono text-xs text-accent-foreground">{a.actor_id}</span>
              <span>{a.event_type.replace(/_/g, " ")}</span>
              {a.incidents?.ref && <span className="font-mono text-[11px] text-muted-foreground">{a.incidents.ref}</span>}
            </li>
          ))}
          {s.activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
        </ul>
      </Panel>
    </div>
  );
}
