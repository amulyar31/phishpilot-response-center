
CREATE TABLE public.profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, role text NOT NULL DEFAULT 'analyst', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref text NOT NULL UNIQUE DEFAULT ('PP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))), title text NOT NULL, source_type text NOT NULL CHECK (source_type IN ('email','url','screenshot')), raw_content text NOT NULL, status text NOT NULL DEFAULT 'submitted', risk_score int, risk_level text, confidence text, score_breakdown jsonb, is_demo boolean NOT NULL DEFAULT false, created_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.indicators (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE, indicator_type text NOT NULL, indicator_value text NOT NULL, normalized_value text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.agent_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE, agent_type text NOT NULL CHECK (agent_type IN ('triage','investigation','risk_review','response')), status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')), started_at timestamptz, completed_at timestamptz, summary text, output_json jsonb, error_code text, attempt_number int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE, agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL, evidence_type text NOT NULL, summary text NOT NULL, source text NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(), confidence text NOT NULL DEFAULT 'medium', metadata_json jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.recommendations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE, action_type text NOT NULL, title text NOT NULL, rationale text NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')), simulated_result text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE, reviewer_id uuid NOT NULL REFERENCES public.profiles(id), decision text NOT NULL CHECK (decision IN ('approved','rejected')), note text, decided_at timestamptz NOT NULL DEFAULT now(), UNIQUE (recommendation_id));
CREATE TABLE public.audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid REFERENCES public.incidents(id) ON DELETE SET NULL, actor_id text NOT NULL, event_type text NOT NULL, details_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.scoring_rules (key text PRIMARY KEY, label text NOT NULL, points int NOT NULL, enabled boolean NOT NULL DEFAULT true);
CREATE TABLE public.threat_fixtures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, value text NOT NULL, verdict text NOT NULL CHECK (verdict IN ('malicious','suspicious','benign')), source text NOT NULL DEFAULT 'Synthetic Reputation Fixture', note text);
CREATE TABLE public.security_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), indicator text NOT NULL, log_source text NOT NULL, message text NOT NULL, severity text NOT NULL, observed_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX ON public.incidents (status); CREATE INDEX ON public.incidents (risk_level); CREATE INDEX ON public.incidents (created_at DESC);
CREATE INDEX ON public.indicators (incident_id); CREATE INDEX ON public.agent_runs (incident_id); CREATE INDEX ON public.evidence (incident_id);
CREATE INDEX ON public.recommendations (incident_id); CREATE INDEX ON public.recommendations (status); CREATE INDEX ON public.approvals (recommendation_id);
CREATE INDEX ON public.audit_events (incident_id); CREATE INDEX ON public.audit_events (created_at DESC); CREATE INDEX ON public.threat_fixtures (value); CREATE INDEX ON public.security_logs (indicator);

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['profiles','incidents','indicators','agent_runs','evidence','recommendations','approvals','audit_events','scoring_rules','threat_fixtures','security_logs'] LOOP
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER incidents_updated BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.block_audit_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.block_audit_change();

INSERT INTO public.profiles (id, display_name, role) VALUES ('00000000-0000-0000-0000-000000000001','Demo Analyst','analyst');

INSERT INTO public.scoring_rules (key,label,points) VALUES
('known_malicious','Known malicious indicator (reputation fixture)',35),
('sender_mismatch','Sender / domain mismatch or lookalike',20),
('pressure_language','Credential harvesting or urgent-pressure language',15),
('deceptive_url','Deceptive URL pattern',15),
('corroborating_log','Corroborating suspicious security log',15),
('benign_allowlisted','Verified benign allowlisted sample',-20);

INSERT INTO public.threat_fixtures (kind,value,verdict,note) VALUES
('domain','micros0ft-support.com','malicious','Lookalike of microsoft.com, credential phishing kit (fictional)'),
('domain','secure-login-verify.net','malicious','Credential harvesting landing page (fictional)'),
('domain','parcel-track-update.info','suspicious','Recently registered, low reputation (fictional)'),
('domain','acme-corp.example','benign','Internal company domain (fictional allowlist)'),
('domain','training.acme-corp.example','benign','Internal awareness training portal (fictional allowlist)'),
('sender','security-team@acme-corp.example','benign','Verified internal security team sender (fictional)');

INSERT INTO public.security_logs (indicator,log_source,message,severity) VALUES
('micros0ft-support.com','Synthetic Proxy Log','3 users clicked links to this domain in the last 24h; 1 POST to /login observed','high'),
('secure-login-verify.net','Synthetic DNS Log','Repeated DNS lookups from finance subnet','medium'),
('parcel-track-update.info','Synthetic Mail Gateway Log','Domain seen in 2 inbound messages, SPF result: none','low');

INSERT INTO public.incidents (title, source_type, raw_content, is_demo, created_by) VALUES
('[DEMO DATA] Urgent Account Password Reset','email',E'From: IT Support <it-support@micros0ft-support.com>\nTo: employee@acme-corp.example\nSubject: Urgent Account Password Reset\n\nDear user,\nYour Microsoft 365 password expires in 2 hours. You must verify your credentials immediately or your account will be suspended.\nVerify now: http://micros0ft-support.com/login/verify?user=employee\n\nMicrosoft Security Team',true,'00000000-0000-0000-0000-000000000001'),
('[DEMO DATA] Delivery Confirmation Required','email',E'From: Parcel Service <notify@parcel-track-update.info>\nTo: employee@acme-corp.example\nSubject: Delivery Confirmation Required\n\nWe attempted to deliver your package today. Please confirm your delivery details within 48 hours to avoid return to sender.\nTrack: https://parcel-track-update.info/track\n\nCustomer Service',true,'00000000-0000-0000-0000-000000000001'),
('[DEMO DATA] Internal Security Awareness Training','email',E'From: Security Team <security-team@acme-corp.example>\nTo: all-staff@acme-corp.example\nSubject: Internal Security Awareness Training\n\nHi team,\nThis quarter''s security awareness training is now available on the internal training portal. Please complete it by the end of the month.\nhttps://training.acme-corp.example/q4\n\nThanks,\nSecurity Team',true,'00000000-0000-0000-0000-000000000001');
