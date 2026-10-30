# PhishPilot — Implementation Plan

Multi-agent phishing investigation app. No sign-in (per your request); Supabase is used purely as the database. All business logic runs on the server, never in the browser.

## Important adjustments to the brief
- **Backend language**: This platform runs TypeScript server code (TanStack Start server functions + `/api/...` server routes), not Python/FastAPI. The same endpoints and separation of frontend/backend are kept.
- **No auth**: Tables have Row Level Security enabled with **no public policies**, so the browser cannot read or write the database directly. Only server code (using the private service key) touches data. A fixed "Demo Analyst" identity is recorded as the actor in approvals and audit logs.
- **Honesty labels**: Every screen marks what is deterministic rules, what is AI, and what is synthetic fixture data.

## Database schema (Supabase, all UUID keys, RLS on)
```text
profiles        id, display_name, role, created_at            (seeded "Demo Analyst")
incidents       id, title, source_type(email|url|screenshot), raw_content, status,
                risk_score, risk_level, confidence, is_demo, created_by, created_at, updated_at
indicators      id, incident_id FK, indicator_type, indicator_value, normalized_value, created_at
agent_runs      id, incident_id FK, agent_type(triage|investigation|risk_review|response),
                status(queued|running|completed|failed), started_at, completed_at,
                summary, output_json, error_code, attempt_number
evidence        id, incident_id FK, agent_run_id FK, evidence_type, summary, source,
                observed_at, confidence, metadata_json
recommendations id, incident_id FK, action_type, title, rationale, status(pending|approved|rejected), created_at
approvals       id, recommendation_id FK, reviewer_id FK, decision, note, decided_at
audit_events    id, incident_id FK null, actor_id, event_type, details_json, created_at
scoring_rules   key, label, points, enabled                    (configurable scoring)
threat_fixtures kind(domain|url|sender), value, verdict(malicious|benign|unknown), source   (synthetic reputation + logs)
```
Indexes on incident_id columns, status, risk_level, created_at. Audit table is append-only (no update/delete).

## Agents and orchestrator (server-side)
- **Orchestrator**: creates 4 agent_runs, runs them in order Triage -> Investigation -> Risk Review -> Response, passes structured JSON between them via the incident record, retries failed agents (max 2), locks the incident so a workflow can't run twice, logs each step to audit.
- **Triage Agent**: deterministic extraction (sender, subject, URLs, domains, urgency/credential keywords) plus AI summary of social-engineering patterns. Email text is wrapped as untrusted data; AI output must match a strict schema.
- **Investigation Agent**: checks indicators against synthetic reputation fixtures and synthetic security logs, plus URL pattern checks (lookalike domains, IP hosts, punycode, shorteners). Never fetches URLs. Unknown reputation = "missing evidence", not safe.
- **Risk Reviewer**: backend rule engine computes the 0–100 score from `scoring_rules`; lists reasons, supporting evidence, missing evidence, conflicts; confidence computed separately. AI only writes the explanation, never the score. Labeled "prototype model".
- **Response Agent**: rule-based recommendations by risk level, AI-written rationale; all saved as "pending" for human approval. Approval only records a simulated result.
- AI via Lovable AI Gateway; if the AI fails, agents fall back to deterministic summaries and mark it, so findings are never lost.
- Screenshot upload: validated image (png/jpg, max 5MB), text read by an AI vision model, then treated like email content.

## API endpoints (server routes)
POST/GET `/api/incidents`, GET `/api/incidents/:id`, POST `/api/incidents/:id/analyze`, GET `/api/incidents/:id/events`, POST `/api/recommendations/:id/decision`, GET `/api/audit`, plus `/api/demo/reset`. Consistent `{ ok, data | error }` JSON, input validation, simple per-IP rate limiting.

## Screens
Overview dashboard, Submit incident (Email / URL / Screenshot tabs), Incidents list (search/filter/sort/pagination), Incident detail (workflow tracker, score breakdown, indicators, evidence, 4 expandable agent cards, recommendations, audit timeline), Approval queue (confirm dialog + note), Audit logs (search/filter), Settings & demo data (config status, reset demo data).

Design: deep navy + charcoal, white surfaces, grey backgrounds, orange accent, clean SOC dashboard, responsive for your phone-size preview too.

## Demo data
Three fictional "DEMO DATA" incidents (High: password reset lookalike; Medium: delivery confirmation; Low: internal training), runnable end to end through the real pipeline.

## Build order and verification
1. Schema, fixtures, scoring rules, server foundation -> test endpoints.
2. Submission + incident list/detail.
3. Orchestrator + agents -> run demo incidents, check scores (High/Medium/Low).
4. Approvals + audit + dashboard.
5. UI polish, automated tests for scoring rules and thresholds.
After each phase I'll report what works and what remains.
