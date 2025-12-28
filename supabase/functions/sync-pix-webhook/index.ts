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

type SyncWebhookPayload = {
  idTransaction: string;
  amount: number;
  status: string;
  [key: string]: any;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json() as SyncWebhookPayload;

    console.log("Webhook Sync recebido:", {
      idTransaction: payload.idTransaction,
      status: payload.status,
      amount: payload.amount,
    });

    if (!payload.idTransaction || !payload.amount || !payload.status) {
      console.error("Webhook inválido", payload);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txError } = await supabase
      .from("pix_transactions")
      .select("id, amount, client_email")
      .eq("sync_id_transaction", payload.idTransaction)
      .maybeSingle();

    if (txError) {
      console.error("Erro ao buscar transação:", txError);
    }

    if (!tx) {
      console.error("Transação não encontrada para idTransaction", payload.idTransaction);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (Number(tx.amount) !== Number(payload.amount)) {
      console.error("Valor divergente, não liberar acesso", {
        esperado: tx.amount,
        recebido: payload.amount,
        idTransaction: payload.idTransaction,
      });
    }

    const statusUpper = payload.status.toUpperCase();
    const isPaidStatus = ["COMPLETED", "PAID", "APPROVED"].includes(statusUpper);

    const { error: updateError } = await supabase
      .from("pix_transactions")
      .update({
        status: statusUpper,
        raw_webhook: payload,
        paid_at: isPaidStatus ? new Date().toISOString() : null,
      })
      .eq("sync_id_transaction", payload.idTransaction);

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
        }
      } else {
        console.log("Acesso VIP já existia, não duplicar", tx.client_email);
      }
    } else {
      console.log("Status não pago, apenas registrando no histórico", statusUpper);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função sync-pix-webhook:", error);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
