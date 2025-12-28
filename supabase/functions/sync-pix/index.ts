import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIBOPAY_BASE_URL = "https://api.tribopay.com.br/api/public/cash";
const TRIBOPAY_API_KEY = Deno.env.get("TRIBOPAY_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// URL pública HTTPS do webhook desta função no backend (obrigatório HTTPS)
const TRIBOPAY_POSTBACK_URL =
  "https://ysxtcjvskdedgiqdiqsq.functions.supabase.co/sync-pix-webhook";

if (!TRIBOPAY_API_KEY) {
  console.error("TRIBOPAY_API_KEY não configurada nos segredos do projeto.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function sanitizeEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length > 255) return trimmed.slice(0, 255);
  return trimmed;
}

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  // Validação simples, mas suficiente para evitar lixo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 255;
}

function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function isValidCPF(cpf: string): boolean {
  const cleaned = onlyDigits(cpf);
  if (cleaned.length !== 11 || /^([0-9])\1{10}$/.test(cleaned)) return false;

  const calcCheckDigit = (base: string): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i]) * (base.length + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcCheckDigit(cleaned.slice(0, 9));
  const d2 = calcCheckDigit(cleaned.slice(0, 10));

  return d1 === parseInt(cleaned[9]) && d2 === parseInt(cleaned[10]);
}

type CreatePixRequestBody = {
  amount: number | string;
  description?: string;
  client: {
    name?: string;
    email?: string;
    cpf?: string;
  };
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
    if (!TRIBOPAY_API_KEY) {
      return new Response(
        JSON.stringify({ error: "CONFIG_ERROR", message: "API Key da TriboPay não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as CreatePixRequestBody;

    const rawAmount = body.amount;
    const normalizedAmount = typeof rawAmount === "string" ? Number(rawAmount) : rawAmount;

    if (!Number.isFinite(normalizedAmount)) {
      throw new Error("Valor inválido: amount precisa ser numérico");
    }

    // amount aqui é em reais (ex.: 150 = R$ 150,00)
    if (normalizedAmount < 50) {
      throw new Error("Valor inválido: o mínimo é R$ 50,00");
    }

    const cents = Math.round(normalizedAmount * 100);
    if (cents <= 0) {
      throw new Error("Valor inválido em centavos");
    }

    const name = (body.client?.name || "Cliente VIP").toString().trim().slice(0, 100);
    const email = sanitizeEmail(body.client?.email || "cliente@example.com");
    const cpfDigits = onlyDigits(body.client?.cpf || "");

    if (!isValidEmail(email)) {
      throw new Error("E-mail inválido para pagamento PIX");
    }

    if (!isValidCPF(cpfDigits)) {
      throw new Error("CPF inválido para pagamento PIX");
    }

    const externalId = `pedido_${Date.now()}_${Math.floor(Math.random() * 9999)}`;

    const payload = {
      amount: cents,
      externalId,
      postbackUrl: TRIBOPAY_POSTBACK_URL,
      method: "pix" as const,
      transactionOrigin: "cashin" as const,
      payer: {
        name,
        email,
        document: cpfDigits,
      },
    };

    console.log("Enviando payload para TriboPay:", JSON.stringify({ ...payload, payer: { ...payload.payer, document: "***" } }));

    const response = await fetch(`${TRIBOPAY_BASE_URL}/deposits/pix`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${TRIBOPAY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const rawResponse = await response.text();
    console.log("Resposta bruta da TriboPay:", rawResponse);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "TRIBOPAY_ERROR",
          message: "Não foi possível criar o pagamento PIX na TriboPay",
          details: rawResponse,
          statusCode: response.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    type TriboPayPixResponse = {
      id: string;
      externalId: string;
      method: string;
      status: string;
      pix?: {
        code?: string | null;
        imageBase64?: string | null;
      } | null;
      amount: number;
      netAmount?: number;
      fee?: string;
      createdAt: string;
      [key: string]: unknown;
    };

    let data: TriboPayPixResponse;
    try {
      data = JSON.parse(rawResponse) as TriboPayPixResponse;
    } catch (e) {
      console.error("Erro ao parsear JSON da TriboPay:", e);
      throw new Error("Resposta inválida da TriboPay ao criar o Pix");
    }

    const pixCode = data.pix?.code;
    const pixImageBase64 = data.pix?.imageBase64 ?? null;

    if (!pixCode) {
      console.error("Resposta da TriboPay sem pix.code:", data);
      throw new Error("TriboPay não retornou o código PIX (pix.code)");
    }

    const { error: insertError } = await supabase.from("pix_transactions").insert({
      sync_id_transaction: data.externalId,
      status: data.status?.toUpperCase?.() || "PENDING",
      amount: normalizedAmount,
      description: body.description ?? "Pagamento via PIX (TriboPay)",
      client_name: name,
      client_cpf: cpfDigits,
      client_email: email,
      client_phone: null,
      payment_code: pixCode,
      payment_code_base64: pixImageBase64 || "",
    });

    if (insertError) {
      console.error("Erro ao salvar transação no banco:", insertError);
    }

    const responseBody = {
      id: data.id,
      externalId: data.externalId,
      method: data.method,
      status: data.status,
      pix: {
        code: pixCode,
        imageBase64: pixImageBase64,
      },
      amount: data.amount,
      netAmount: data.netAmount,
      fee: data.fee,
      createdAt: data.createdAt,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função sync-pix (TriboPay):", error);
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
