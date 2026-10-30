// Prototype risk scoring model (NOT a certified phishing detection standard).
// Pure, deterministic. Rules come from the scoring_rules table.

export type ScoringRule = { key: string; label: string; points: number; enabled: boolean };
export type Signal = { key: string; reason: string; evidence?: string[] };

export type ScoreResult = {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH";
  applied: { key: string; label: string; points: number; reason: string; evidence: string[] }[];
};

export function classify(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export function computeScore(signals: Signal[], rules: ScoringRule[]): ScoreResult {
  const byKey = new Map(rules.filter((r) => r.enabled).map((r) => [r.key, r]));
  const applied: ScoreResult["applied"] = [];
  const used = new Set<string>();
  for (const s of signals) {
    const rule = byKey.get(s.key);
    if (!rule || used.has(s.key)) continue; // each rule counts once
    used.add(s.key);
    applied.push({ key: rule.key, label: rule.label, points: rule.points, reason: s.reason, evidence: s.evidence ?? [] });
  }
  const raw = applied.reduce((a, r) => a + r.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, level: classify(score), applied };
}

/** Confidence is separate from risk: how complete/consistent is the evidence. */
export function computeConfidence(input: {
  domainsTotal: number;
  domainsWithReputation: number;
  senderKnown: boolean;
  conflicts: number;
  aiAvailable: boolean;
  sourceType: string;
}): "LOW" | "MEDIUM" | "HIGH" {
  let pts = 0;
  if (input.domainsTotal > 0) pts += (input.domainsWithReputation / input.domainsTotal) * 2;
  if (input.senderKnown || input.sourceType === "url") pts += 1;
  if (input.aiAvailable) pts += 0.5;
  pts -= input.conflicts;
  if (pts >= 3) return "HIGH";
  if (pts >= 1.2) return "MEDIUM";
  return "LOW";
}
