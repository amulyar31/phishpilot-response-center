import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, type Evidence, type Recommendation, type ScoreBreakdown } from "@/lib/pp/client";
import { PageHeader, ErrorBox, Loading, Panel, RiskBadge } from "@/components/pp/bits";
import { RecommendationItem } from "@/components/pp/decision";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "Approval queue — PhishPilot" },
      { name: "description", content: "Review evidence and approve or reject agent recommendations." },
      { property: "og:title", content: "Approval queue — PhishPilot" },
      { property: "og:description", content: "Review evidence and approve or reject agent recommendations." },
    ],
  }),
  component: Approvals,
});

type Pending = Recommendation & { evidence: Evidence[]; incidents: { id: string; ref: string; title: string; risk_score: number | null; risk_level: string | null; confidence: string | null; score_breakdown: ScoreBreakdown | null } };

function Approvals() {
  const q = useQuery({ queryKey: ["approvals"], queryFn: () => api<Pending[]>("/api/approvals"), refetchInterval: 10000 });
  const groups = new Map<string, Pending[]>();
  (q.data ?? []).forEach((r) => groups.set(r.incident_id, [...(groups.get(r.incident_id) ?? []), r]));
  return (
    <>
      <PageHeader title="Approval queue" subtitle="No action runs without an analyst decision. Approved actions are simulated in this prototype." />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : groups.size === 0 ? (
        <Panel><p className="py-6 text-center text-sm text-muted-foreground">No pending recommendations.</p></Panel>
      ) : (
        <div className="space-y-5">
          {[...groups.values()].map((recs) => {
            const first = recs[0]!;
            const inc = first.incidents;
            const ev = first.evidence.filter((e) => !["missing_evidence"].includes(e.evidence_type)).slice(0, 6);
            return (
              <Panel key={inc.id} title={<Link to="/incidents/$id" params={{ id: inc.id }} className="hover:underline">{inc.ref} · {inc.title}</Link>} right={<RiskBadge level={inc.risk_level} score={inc.risk_score} />}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 text-xs">
                    <div className="label-caps">Evidence review · confidence {inc.confidence}</div>
                    {inc.score_breakdown?.explanation && <p className="text-sm leading-relaxed">{inc.score_breakdown.explanation}</p>}
                    <ul className="space-y-1">{ev.map((e) => <li key={e.id} className="rounded border p-1.5">{e.summary}<span className="block text-[10px] text-muted-foreground">{e.source}</span></li>)}</ul>
                  </div>
                  <div className="space-y-2">{recs.map((r) => <RecommendationItem key={r.id} rec={r} />)}</div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
