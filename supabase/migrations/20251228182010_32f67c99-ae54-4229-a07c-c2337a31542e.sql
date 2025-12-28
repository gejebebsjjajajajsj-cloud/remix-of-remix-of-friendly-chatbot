-- Allow preloading tokens not yet vinculados a uma transação
ALTER TABLE public.vip_tokens
ALTER COLUMN pix_transaction_id DROP NOT NULL;