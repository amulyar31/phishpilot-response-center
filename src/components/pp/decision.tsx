import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type Recommendation } from "@/lib/pp/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge, fmtDate } from "./bits";

export function RecommendationItem({ rec }: { rec: Recommendation }) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (decision: "approved" | "rejected") => api<{ simulated_result: string | null }>(`/api/recommendations/${rec.id}/decision`, { method: "POST", json: { decision, note: note || undefined, confirm: true } }),
    onSuccess: (r, d) => { toast.success(d === "approved" ? `Approved. ${r.simulated_result ?? ""}` : "Recommendation rejected and recorded."); qc.invalidateQueries(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const approval = rec.approvals?.[0];
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm font-semibold">{rec.title}</div>
        <StatusBadge status={rec.status} />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rec.rationale}</p>
      {rec.simulated_result && <p className="mt-2 rounded bg-info-bg px-2 py-1 text-xs text-info">{rec.simulated_result}</p>}
      {approval && <p className="mt-2 text-xs text-muted-foreground">Decided by Demo Analyst · {fmtDate(approval.decided_at)}{approval.note ? ` — “${approval.note}”` : ""}</p>}
      {rec.status === "pending" && (
        <div className="mt-3 space-y-2">
          <Textarea rows={2} placeholder="Analyst review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" variant="brand" disabled={m.isPending} onClick={() => setPending("approved")}>Approve</Button>
            <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => setPending("rejected")}>Reject</Button>
          </div>
        </div>
      )}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending === "approved" ? "Approve" : "Reject"} this recommendation?</AlertDialogTitle>
            <AlertDialogDescription>
              “{rec.title}”. Your decision{note ? " and note" : ""} will be permanently recorded in the audit log.
              {pending === "approved" && " The action is simulated only — nothing is executed on real systems."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pending) m.mutate(pending); setPending(null); }}>Confirm {pending === "approved" ? "approval" : "rejection"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
