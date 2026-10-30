import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/pp/client";
import { PageHeader, Panel, ErrorBox, Loading, RiskBadge, StatusBadge, Tag } from "@/components/pp/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & demo data — PhishPilot" },
      { name: "description", content: "Configuration status, scoring rules and demo incident management." },
      { property: "og:title", content: "Settings & demo data — PhishPilot" },
      { property: "og:description", content: "Configuration status, scoring rules and demo incident management." },
    ],
  }),
  component: Settings,
});

type Rule = { key: string; label: string; points: number; enabled: boolean };
type Cfg = { database: boolean; aiConfigured: boolean; rules: Rule[]; fixtures: number; logs: number; profile: { display_name: string; role: string } | null; demo: { id: string; ref: string; title: string; status: string; risk_level: string | null }[] };

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["config"], queryFn: () => api<Cfg>("/api/config") });
  const [confirm, setConfirm] = useState(false);
  const reset = useMutation({
    mutationFn: async () => {
      const r = await api<{ created: { id: string }[] }>("/api/demo/reset", { method: "POST" });
      r.created.forEach((c) => void api(`/api/incidents/${c.id}/analyze`, { method: "POST", json: {} }).finally(() => qc.invalidateQueries()));
      return r;
    },
    onSuccess: () => { toast.success("Demo data reset — investigations started"); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rule = useMutation({
    mutationFn: (r: Rule) => api("/api/config", { method: "PATCH", json: { key: r.key, points: r.points, enabled: r.enabled } }),
    onSuccess: () => { toast.success("Scoring rule saved (applies to new runs)"); qc.invalidateQueries({ queryKey: ["config"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data!;
  const Row = ({ ok, label, note }: { ok: boolean; label: string; note: string }) => (
    <li className="flex items-start gap-2 py-2">{ok ? <CheckCircle2 className="mt-0.5 size-4 text-risk-low" /> : <XCircle className="mt-0.5 size-4 text-risk-high" />}<div><div className="text-sm font-medium">{label}</div><div className="text-xs text-muted-foreground">{note}</div></div></li>
  );
  return (
    <>
      <PageHeader title="Settings & demo data" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Configuration status">
          <ul className="-my-2 divide-y">
            <Row ok={c.database} label="Database (Supabase PostgreSQL)" note="Real integration. Tables protected by row-level security; only the server can access them." />
            <Row ok={c.aiConfigured} label="AI provider (Lovable AI)" note="Real integration. Used for narrative summaries and screenshot transcription only — never for scores." />
            <Row ok={c.fixtures > 0} label={`Reputation fixtures: ${c.fixtures}`} note="Synthetic data. No live threat-intel feed is connected." />
            <Row ok={c.logs > 0} label={`Security logs: ${c.logs}`} note="Synthetic data used to demonstrate log correlation." />
            <Row ok label="URL fetching disabled" note="Submitted URLs are never opened. Analysis is structural only." />
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5"><Tag tone="info">Deterministic: extraction, scoring, playbooks</Tag><Tag tone="brand">AI: summaries, OCR</Tag><Tag>Synthetic: fixtures, logs</Tag></div>
        </Panel>
        <Panel title="Account">
          <div className="space-y-1 text-sm">
            <div><span className="label-caps">Name </span>{c.profile?.display_name}</div>
            <div><span className="label-caps">Role </span>{c.profile?.role}</div>
            <p className="pt-2 text-xs text-muted-foreground">Sign-in is disabled for this demo. All decisions are recorded under the Demo Analyst profile.</p>
          </div>
        </Panel>
        <Panel title="Scoring rules" right={<Tag>Prototype model</Tag>} className="lg:col-span-2">
          <p className="mb-3 text-xs text-muted-foreground">Points are applied once per rule; total is clamped to 0–100. 0–29 LOW · 30–59 MEDIUM · 60–100 HIGH. Not a certified detection standard.</p>
          <ul className="divide-y">{c.rules.map((r) => <RuleRow key={r.key} r={r} onSave={(v) => rule.mutate(v)} />)}</ul>
        </Panel>
        <Panel title="Demo incidents" right={<Tag>Demo data · fictional</Tag>} className="lg:col-span-2">
          <ul className="mb-4 divide-y">{c.demo.map((d) => (
            <li key={d.id} className="flex items-center gap-2 py-2 text-sm"><Link to="/incidents/$id" params={{ id: d.id }} className="min-w-0 flex-1 truncate hover:underline">{d.ref} · {d.title}</Link><StatusBadge status={d.status} /><RiskBadge level={d.risk_level} /></li>
          ))}{c.demo.length === 0 && <li className="py-2 text-sm text-muted-foreground">No demo incidents.</li>}</ul>
          <Button variant="brand" disabled={reset.isPending} onClick={() => setConfirm(true)}>{reset.isPending ? "Resetting…" : "Reset & re-run demo data"}</Button>
        </Panel>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reset demo data?</AlertDialogTitle><AlertDialogDescription>Deletes the three DEMO DATA incidents and their findings, recreates them and runs the agents again. Your own incidents are not touched.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => reset.mutate()}>Reset</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RuleRow({ r, onSave }: { r: Rule; onSave: (r: Rule) => void }) {
  const [pts, setPts] = useState(String(r.points));
  const [en, setEn] = useState(r.enabled);
  const dirty = Number(pts) !== r.points || en !== r.enabled;
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span className="min-w-0 flex-1 text-sm">{r.label}</span>
      <Input type="number" min={-50} max={50} value={pts} onChange={(e) => setPts(e.target.value)} className="h-8 w-20 font-mono" aria-label={`${r.label} points`} />
      <Switch checked={en} onCheckedChange={setEn} aria-label={`${r.label} enabled`} />
      <Button size="sm" variant="outline" disabled={!dirty || !Number.isInteger(Number(pts))} onClick={() => onSave({ ...r, points: Number(pts), enabled: en })}>Save</Button>
    </li>
  );
}
