ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS final_verification_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_verification jsonb,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;