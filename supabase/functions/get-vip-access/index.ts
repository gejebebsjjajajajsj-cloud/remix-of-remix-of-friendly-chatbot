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
    const { externalId } = await req.json();

    if (!externalId || typeof externalId !== "string") {
      return new Response(JSON.stringify({ error: "INVALID_REQUEST" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txError } = await supabase
      .from("pix_transactions")
      .select("id, status")
      .eq("sync_id_transaction", externalId)
      .maybeSingle();

    if (txError) {
      console.error("Erro ao buscar transação por externalId: ", txError);
      return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tx) {
      return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = (tx.status || "").toString().toUpperCase();
    const isPaid = status === "PAID" || status === "APPROVED";

    let token: string | null = null;

    if (isPaid) {
      const { data: vipToken, error: vipTokenError } = await supabase
        .from("vip_tokens")
        .select("token")
        .eq("pix_transaction_id", tx.id)
        .maybeSingle();

      if (vipTokenError) {
        console.error("Erro ao buscar token VIP: ", vipTokenError);
      }

      token = vipToken?.token ?? null;
    }

    return new Response(
      JSON.stringify({
        status,
        isPaid,
        token,
        discordLink: "https://discord.gg/zbkNdVqYhf",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Erro na função get-vip-access:", error);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
