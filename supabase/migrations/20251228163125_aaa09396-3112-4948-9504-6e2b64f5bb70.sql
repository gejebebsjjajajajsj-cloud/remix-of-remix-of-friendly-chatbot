-- Create vip_tokens table to manage one-time Discord access tokens linked to VIP purchases
CREATE TABLE IF NOT EXISTS public.vip_tokens (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unused', -- 'unused' | 'used'
  pix_transaction_id BIGINT NOT NULL REFERENCES public.pix_transactions(id) ON DELETE CASCADE,
  client_email VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

-- Enable Row Level Security; only backend (service role) will access this table
ALTER TABLE public.vip_tokens ENABLE ROW LEVEL SECURITY;

-- Basic policy allowing no direct access for anonymous users (frontend)
CREATE POLICY "No direct access to vip_tokens from clients"
ON public.vip_tokens
AS RESTRICTIVE
FOR ALL
TO PUBLIC
USING (false)
WITH CHECK (false);

-- Index to speed up lookups by token
CREATE INDEX IF NOT EXISTS vip_tokens_token_idx ON public.vip_tokens(token);
