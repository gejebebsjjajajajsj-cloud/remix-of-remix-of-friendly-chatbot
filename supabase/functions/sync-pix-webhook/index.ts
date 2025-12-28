import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type TriboPayWebhookPayload = {
  externalId: string;
  status: string;
  amount: number; // em centavos
  endToEndId?: string;
  [key: string]: unknown;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as TriboPayWebhookPayload;

    console.log("Webhook TriboPay recebido:", {
      externalId: payload.externalId,
      status: payload.status,
      amount: payload.amount,
      endToEndId: payload.endToEndId,
    });

    if (!payload.externalId || !payload.status || typeof payload.amount !== "number") {
      console.error("Webhook inválido da TriboPay", payload);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txError } = await supabase
      .from("pix_transactions")
      .select("id, amount, client_email")
      .eq("sync_id_transaction", payload.externalId)
      .maybeSingle();

    if (txError) {
      console.error("Erro ao buscar transação pelo externalId:", txError);
    }

    if (!tx) {
      console.error("Transação não encontrada para externalId", payload.externalId);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedCents = Math.round(Number(tx.amount) * 100);
    if (expectedCents !== Number(payload.amount)) {
      console.error("Valor divergente, não liberar acesso", {
        esperadoCentavos: expectedCents,
        recebidoCentavos: payload.amount,
        externalId: payload.externalId,
      });
    }

    const statusLower = payload.status.toLowerCase();
    const isPaidStatus = statusLower === "paid" || statusLower === "approved";

    const { error: updateError } = await supabase
      .from("pix_transactions")
      .update({
        status: payload.status.toUpperCase(),
        raw_webhook: payload,
        paid_at: isPaidStatus ? new Date().toISOString() : null,
      })
      .eq("sync_id_transaction", payload.externalId);

    if (updateError) {
      console.error("Erro ao atualizar transação:", updateError);
    }

    if (isPaidStatus) {
      const { data: existingAccess, error: accessSelectError } = await supabase
        .from("vip_access")
        .select("id")
        .eq("pix_transaction_id", tx.id)
        .maybeSingle();

      if (accessSelectError) {
        console.error("Erro ao verificar acesso existente:", accessSelectError);
      }

      if (!existingAccess) {
        const { error: insertAccessError } = await supabase.from("vip_access").insert({
          pix_transaction_id: tx.id,
          client_email: tx.client_email,
          access_type: "VIP_DISCORD",
        });

        if (insertAccessError) {
          console.error("Erro ao criar acesso VIP:", insertAccessError);
        } else {
          console.log("Acesso VIP liberado para", tx.client_email);

          // Gera um token único para o Discord vinculado a essa transação
          const token = crypto.randomUUID();

          const { error: insertTokenError } = await supabase.from("vip_tokens").insert({
            pix_transaction_id: tx.id,
            client_email: tx.client_email,
            token,
          });

          if (insertTokenError) {
            console.error("Erro ao criar token VIP para Discord:", insertTokenError);
          } else {
            console.log("Token VIP gerado para Discord para", tx.client_email);
          }
        }
      } else {
        console.log("Acesso VIP já existia, não duplicar", tx.client_email);
      }
    } else {
      console.log("Status não pago/aprovado, apenas registrando no histórico", payload.status);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função sync-pix-webhook (TriboPay):", error);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
