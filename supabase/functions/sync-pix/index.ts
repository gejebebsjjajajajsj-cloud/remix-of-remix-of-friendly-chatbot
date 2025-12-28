import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYNC_BASE_URL = "https://api.syncpayments.com.br";
const SYNC_CLIENT_ID = Deno.env.get("SYNC_CLIENT_ID");
const SYNC_CLIENT_SECRET = Deno.env.get("SYNC_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SYNC_CLIENT_ID || !SYNC_CLIENT_SECRET) {
  console.error("SYNC_CLIENT_ID ou SYNC_CLIENT_SECRET não configurados nos segredos do projeto.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

async function getSyncAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${SYNC_BASE_URL}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SYNC_CLIENT_ID,
      client_secret: SYNC_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Erro ao autenticar na Sync:", res.status, text);
    throw new Error("Não foi possível autenticar na Sync Payments");
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // margem de 60s
  return cachedToken!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não suportado" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const rawAmount = (body as any).amount;
    let amount: number;

    if (typeof rawAmount === "number") {
      amount = rawAmount;
    } else if (typeof rawAmount === "string" && rawAmount.trim() !== "") {
      amount = Number(rawAmount);
    } else {
      // Valor fixo definido no backend quando não vier do frontend
      amount = 150;
    }

    const { description, client, split } = body as {
      description?: string;
      client: { name?: string; cpf?: string; email?: string; phone?: string };
      split?: { percentage: number; user_id: string };
    };

    if (typeof amount !== "number" || Number.isNaN(amount) || amount < 50) {
      throw new Error("Valor inválido: o mínimo para pagamento PIX é R$ 50,00");
    }

    const token = await getSyncAccessToken();

    const rawCpf = (client?.cpf || "00000000000").replace(/[^0-9]/g, "").slice(0, 11);
    const normalizedCpf = rawCpf === "00000000000" || rawCpf.length !== 11 ? "12345678909" : rawCpf;

    const rawPhone = (client?.phone || "11999999999").toString().replace(/[^0-9]/g, "");
    let normalizedPhone = rawPhone;
    if (normalizedPhone.length > 11) {
      normalizedPhone = normalizedPhone.slice(-11);
    }
    if (normalizedPhone.length < 10) {
      normalizedPhone = normalizedPhone.padStart(10, "0");
    }

    const safeClient = {
      name: (client?.name || "Cliente VIP").toString().slice(0, 100),
      cpf: normalizedCpf,
      email: (client?.email || "cliente@example.com").toString().slice(0, 190),
      phone: normalizedPhone,
    };

    const payload: any = {
      amount,
      description: "Pagamento via PIX",
      webhook_url: "https://seusite.com/webhook",
      client: {
        name: "Cliente Final",
        cpf: "12345678900",
        email: "cliente@email.com",
        phone: "11999999999",
      },
    };
    if (split) {
      payload.split = split;
    }

    console.log("Enviando payload para Sync CashIn:", JSON.stringify(payload));

    const resCashIn = await fetch(`${SYNC_BASE_URL}/api/partner/v1/cash-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await resCashIn.text();
    console.log("Resposta bruta da Sync CashIn:", rawBody);

    if (!resCashIn.ok) {
      console.error("Erro HTTP ao criar cash-in na Sync:", resCashIn.status, rawBody);
      return new Response(
        JSON.stringify({
          error: "SYNC_ERROR",
          message: "Não foi possível criar o Pix na Sync",
          details: rawBody,
          statusCode: resCashIn.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let data: {
      message?: string;
      pix_code?: string | null;
      identifier?: string | null;
      paymentCode?: string | null;
      idTransaction?: string | null;
      paymentCodeBase64?: string | null;
      status_transaction?: string | null;
      [key: string]: any;
    } = {};

    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      console.error("Erro ao parsear JSON da Sync:", e);
      throw new Error("Resposta inválida da Sync ao criar o Pix");
    }

    const pixCode = data.pix_code || data.paymentCode;
    const identifier = data.identifier || data.idTransaction;

    if (!pixCode || !identifier) {
      console.error("Resposta da Sync sem dados de Pix esperados:", data);
      throw new Error("Sync não retornou os dados do Pix (pix_code/paymentCode ou identifier/idTransaction)");
    }

    const { error: insertError } = await supabase.from("pix_transactions").insert({
      sync_id_transaction: identifier,
      status: data.status_transaction ?? "WAITING_FOR_APPROVAL",
      amount,
      description: description ?? "Pagamento via PIX",
      client_name: safeClient.name,
      client_cpf: safeClient.cpf,
      client_email: safeClient.email,
      client_phone: safeClient.phone ?? null,
      payment_code: pixCode,
      payment_code_base64: data.paymentCodeBase64 ?? "",
    });

    if (insertError) {
      console.error("Erro ao salvar transação no banco:", insertError);
    }

    const responseBody = {
      identifier,
      pix_code: pixCode,
      pix_code_base64: data.paymentCodeBase64 ?? "",
      status: data.status_transaction ?? "WAITING_FOR_APPROVAL",
      amount,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função sync-pix:", error);
    return new Response(
      JSON.stringify({
        error: "INTERNAL_ERROR",
        message: (error as Error).message ?? "Erro interno",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
