import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RiskBadge({ level, score }: { level: string | null; score?: number | null }) {
  const cls =
    level === "HIGH" ? "bg-risk-high-bg text-risk-high border-risk-high/30"
    : level === "MEDIUM" ? "bg-risk-medium-bg text-risk-medium border-risk-medium/30"
    : level === "LOW" ? "bg-risk-low-bg text-risk-low border-risk-low/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap", cls)}>
      {level ?? "UNSCORED"}
      {score != null && <span className="font-mono font-normal opacity-80">{score}</span>}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted", analyzing: "Investigating", awaiting_approval: "Awaiting approval",
  partial: "Partial — retry", resolved: "Resolved", queued: "Queued", running: "Running",
  completed: "Completed", failed: "Failed", not_started: "Not started", pending: "Pending",
  approved: "Approved", rejected: "Rejected", superseded: "Superseded",
};
export function StatusBadge({ status }: { status: string }) {
  const cls =
    ["running", "analyzing"].includes(status) ? "bg-info-bg text-info"
    : ["completed", "resolved", "approved"].includes(status) ? "bg-risk-low-bg text-risk-low"
    : ["failed", "partial", "rejected"].includes(status) ? "bg-risk-high-bg text-risk-high"
    : ["awaiting_approval", "pending"].includes(status) ? "bg-accent text-accent-foreground"
    : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", cls)}>
      {["running", "analyzing"].includes(status) && <span className="size-1.5 animate-pulse rounded-full bg-info" />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" | "info" }) {
  const cls = tone === "brand" ? "bg-accent text-accent-foreground border-brand/30" : tone === "info" ? "bg-info-bg text-info border-info/20" : "bg-muted text-muted-foreground border-border";
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider", cls)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("card-surface", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-md border border-risk-high/30 bg-risk-high-bg p-3 text-sm text-risk-high">
      {(error as Error)?.message ?? "Something went wrong"}
    </div>
  );
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function duration(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
