INSERT INTO public.scoring_rules (key,label,points) VALUES
('suspicious_reputation','Suspicious (unconfirmed) reputation result',15),
('unverified_sender','Sender authentication incomplete or unverified',10)
ON CONFLICT (key) DO NOTHING;