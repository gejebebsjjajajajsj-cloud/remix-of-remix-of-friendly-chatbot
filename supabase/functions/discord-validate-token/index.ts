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

type ValidateTokenRequest = {
  token?: string;
  discord_user_id?: string;
  discord_username?: string;
};

type ValidateTokenResponse =
  | {
      valid: true;
      tokenId: number;
      clientEmail: string | null;
      pixTransactionId: number;
      message: string;
    }
  | {
      valid: false;
      reason: string;
      message: string;
    };

serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    const body: ValidateTokenResponse = {
      valid: false,
      reason: "METHOD_NOT_ALLOWED",
      message: "Use POST para validar o token.",
    };
    return new Response(JSON.stringify(body), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as ValidateTokenRequest;

    if (!payload.token || typeof payload.token !== "string") {
      const body: ValidateTokenResponse = {
        valid: false,
        reason: "MISSING_TOKEN",
        message: "Campo 'token' é obrigatório no corpo da requisição.",
      };
      return new Response(JSON.stringify(body), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[discord-validate-token] Validando token recebido", {
      tokenPrefix: payload.token.slice(0, 8),
      discord_user_id: payload.discord_user_id,
      discord_username: payload.discord_username,
    });

    const { data: tokenRow, error: tokenError } = await supabase
      .from("vip_tokens")
      .select("id, status, client_email, pix_transaction_id")
      .eq("token", payload.token)
      .maybeSingle();

    if (tokenError) {
      console.error("Erro ao buscar token na tabela vip_tokens:", tokenError);
    }

    if (!tokenRow) {
      const body: ValidateTokenResponse = {
        valid: false,
        reason: "TOKEN_NOT_FOUND",
        message: "Token inválido ou não encontrado.",
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenRow.status !== "unused") {
      const body: ValidateTokenResponse = {
        valid: false,
        reason: "TOKEN_ALREADY_USED",
        message: "Esse token já foi utilizado anteriormente.",
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("vip_tokens")
      .update({
        status: "used",
        used_at: new Date().toISOString(),
      })
      .eq("id", tokenRow.id);

    if (updateError) {
      console.error("Erro ao marcar token como usado:", updateError);
    }

    const body: ValidateTokenResponse = {
      valid: true,
      tokenId: tokenRow.id,
      clientEmail: tokenRow.client_email,
      pixTransactionId: tokenRow.pix_transaction_id,
      message: "Token válido. Pode liberar o acesso VIP para o usuário.",
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[discord-validate-token] Erro inesperado:", error);

    const body: ValidateTokenResponse = {
      valid: false,
      reason: "INTERNAL_ERROR",
      message: "Erro interno ao validar o token.",
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
