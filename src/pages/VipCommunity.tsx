import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Headset, Sparkles } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import vipBanner from "@/assets/vip-community-banner.jpg";
import nichoHotImage from "@/assets/nicho-hot.webp";
import ratariasDigitalImage from "@/assets/ratarias-digital.webp";
import vipPanelPenguin from "@/assets/vip-panel-penguin.png";

const VipCommunity = () => {
  const { toast } = useToast();
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [isLoadingPix, setIsLoadingPix] = useState(false);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(150);
  const [lastSyncErrorJson, setLastSyncErrorJson] = useState<string | null>(null);
  const [externalId, setExternalId] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [vipToken, setVipToken] = useState<string | null>(null);
  const [vipDiscordLink, setVipDiscordLink] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Comunidade VIP no Discord | R$ 150/mês";

    if (!externalId) return;

    let interval: number | undefined;

    const checkStatus = async () => {
      try {
        setIsCheckingPayment(true);

        const { data, error } = await supabase.functions.invoke("get-vip-access", {
          body: { externalId },
        });

        if (error) {
          console.error("Erro ao verificar status do pagamento:", error);
          return;
        }

        if (data && (data as any).isPaid && (data as any).token && (data as any).discordLink) {
          setVipToken((data as any).token as string);
          setVipDiscordLink((data as any).discordLink as string);

          if (interval) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Erro inesperado ao checar pagamento:", err);
      } finally {
        setIsCheckingPayment(false);
      }
    };

    interval = window.setInterval(checkStatus, 5000);
    checkStatus();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [externalId]);

  const pillars = [
    "2 calls AO VIVO por semana no Discord pra destrinchar suas telas, ajustar oferta e destravar sua cabeça.",
    "Modelos prontos de ofertas hot e low ticket pra você adaptar rápido e colocar pra rodar sem travar.",
    "Estratégias de tela fake, funil e bastidores que eu uso no dia a dia pra bater venda todo santo dia.",
    "Acesso à comunidade fechada no Discord pra nunca mais tentar adivinhar o que fazer sozinho.",
  ];

  const handleGeneratePix = async () => {
    try {
      const rawAmount = amount;
      const normalizedAmount = Number(rawAmount);

      if (!Number.isFinite(normalizedAmount) || normalizedAmount < 50) {
        toast({
          title: "Valor mínimo R$ 50,00",
          description: "Ajusta o valor antes de gerar o Pix.",
          variant: "destructive",
        });
        return;
      }

      setIsLoadingPix(true);
      setVipToken(null);
      setVipDiscordLink(null);
      setExternalId(null);

      const { data, error } = await supabase.functions.invoke("sync-pix", {
        body: {
          amount: normalizedAmount,
          description: "Pagamento PIX Comunidade VIP",
          client: {
            name: "Cliente VIP",
            email: "teste+vip@example.com",
            cpf: "12345678909", // CPF de teste válido apenas para ambiente de desenvolvimento
          },
        },
      });

      if (error || !data) {
        console.error("Erro ao gerar Pix:", error);
        toast({
          title: "Não foi possível gerar o Pix",
          description: "Tenta de novo em alguns segundos ou chama no suporte.",
          variant: "destructive",
        });
        return;
      }

      if ((data as any).error) {
        console.error("Erro da TriboPay ao gerar Pix:", data);

        try {
          setLastSyncErrorJson(JSON.stringify(data, null, 2));
        } catch {
          setLastSyncErrorJson(String(data));
        }

        let descricaoErro = (data as any).message as string | undefined;
        try {
          if (!descricaoErro && (data as any).details) {
            const raw = JSON.parse((data as any).details as string);
            descricaoErro = raw.message || descricaoErro;
          }
        } catch (e) {
          console.error("Erro ao parsear details da Sync:", e);
        }

        toast({
          title: "Não foi possível gerar o Pix",
          description:
            descricaoErro ||
            "A API de pagamento retornou um erro. Tenta novamente em alguns minutos ou chama no suporte.",
          variant: "destructive",
        });
        return;
      }

      setLastSyncErrorJson(null);
      const pixFromObject = (data as any).pix;
      const pixCodeFromObject = pixFromObject?.code ?? (data as any).pix_code;
      const externalIdFromObject = (data as any).externalId ?? null;

      setPixCode(pixCodeFromObject);
      setExternalId(externalIdFromObject);
      setIsPixModalOpen(true);
      toast({
        title: "Pix gerado com sucesso",
        description: "Agora é só pagar o Pix para liberar seu acesso ao VIP automaticamente.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro inesperado",
        description: "Tenta novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPix(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixCode) return;
    try {
      await navigator.clipboard.writeText(pixCode);
      toast({
        title: "Pix copiado",
        description: "Código Pix copia e cola copiado com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao copiar Pix:", err);
      toast({
        title: "Não consegui copiar",
        description: "Você pode selecionar o texto e copiar manualmente.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="page-shell">
      <article className="bio-card w-full max-w-5xl animate-enter overflow-hidden p-0 text-left">
        <img
          src={vipBanner}
          alt="Banner principal da Comunidade VIP Community Network"
          className="w-full h-auto max-h-[420px] object-cover sm:rounded-t-[1.75rem]"
          loading="lazy"
        />

        <section className="p-4 sm:p-6 md:p-8 space-y-8">
          <header className="space-y-4 text-left">
            <p className="banner-pill vip-chip inline-flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-primary" />
              Comunidade VIP no Discord
            </p>
            <h1 className="font-cartoon text-2xl sm:text-3xl text-foreground">
              A sala fechada pra você dominar hot, low ticket e oferta todo santo dia.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              Esquece teoria bonita: é tela aberta, oferta destrinchada e 2 calls semanais no Discord pra você finalmente
              entender o jogo com alguém olhando a sua operação de perto.
            </p>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Button size="sm" className="sm:size-default" onClick={handleGeneratePix} disabled={isLoadingPix}>
                {isLoadingPix ? "Gerando Pix..." : "Quero participar"}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </Button>

              <div
                aria-label="Principais temas da Comunidade VIP"
                className="grid grid-cols-2 gap-2 sm:gap-3 max-w-xs sm:max-w-sm"
              >
                <figure className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
                  <img
                    src={nichoHotImage}
                    alt="Comunidade VIP focada em nicho hot"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </figure>
                <figure className="overflow-hidden rounded-xl border border-border/60 bg-background/80">
                  <img
                    src={ratariasDigitalImage}
                    alt="Ensinamentos e ratarias do digital dentro da Comunidade VIP"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
          </header>

          <section className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <section aria-label="O que você recebe" className="space-y-4">
              <h2 className="font-cartoon text-xl sm:text-2xl text-foreground flex items-center gap-2">
                <Headset className="h-5 w-5 text-secondary" />
                O que você leva pra dentro do VIP
              </h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {pillars.map((item) => (
                  <li key={item} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-4 text-xs sm:text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">Tudo acontece dentro do Discord:</strong> você entra, já cai no
                  servidor e tem acesso às salas, materiais e agenda das calls de terça e quinta.
                </p>
                <p>
                  Se você está cansado de ficar catando print de tela fake por aí, aqui você vê o bastidor real e pode tirar
                  dúvida olhando exatamente a sua operação.
                </p>
              </div>
            </section>

            <aside
              aria-label="Painel de inscrição"
              className="space-y-4 rounded-2xl border border-border/80 bg-background/95 p-5 shadow-[var(--shadow-glow)]"
            >
              <div className="space-y-3">
                <p className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Assinatura mensal para a Comunidade VIP no Discord
                </p>

                <h2 className="font-cartoon text-xl sm:text-2xl text-foreground leading-tight">
                  Como entrar para o VIP
                </h2>

                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
                  Clica no botão, gera o Pix e assim que o pagamento for confirmado o acesso ao servidor fechado é liberado
                  automaticamente.
                </p>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-cartoon text-4xl sm:text-5xl tracking-tight text-primary drop-shadow-[var(--shadow-glow)]">
                  R$ 150
                </span>
                <span className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  / mês
                </span>
              </div>

              </div>


              <figure className="mt-4 sm:mt-5 w-full flex justify-center">
                <div className="hover-scale relative overflow-hidden rounded-2xl border border-border/70 bg-muted/40 p-2 shadow-[var(--shadow-elevated,0_18px_45px_rgba(0,0,0,0.35))]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  <img
                    src={vipPanelPenguin}
                    alt="Comunidade VIP R$ 150 com mascote pinguim no painel de compra"
                    className="relative z-[1] w-full h-auto object-contain"
                    loading="lazy"
                  />
                </div>
              </figure>

              <Button size="lg" className="mt-4 w-full animate-enter" onClick={handleGeneratePix} disabled={isLoadingPix}>
                {isLoadingPix ? "Gerando Pix..." : "Gerar Pix e entrar na VIP"}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>

              <p className="text-[11px] text-muted-foreground">
                Pagamento 100% seguro. Assim que a compra é confirmada, o sistema libera seu acesso ao servidor fechado VIP.
              </p>

              {lastSyncErrorJson && (
                <details className="mt-2 text-[11px] text-muted-foreground">
                  <summary>Ver resposta técnica da API de pagamento</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded border border-border/40 bg-muted/40 p-2 text-[10px]">
                    {lastSyncErrorJson}
                  </pre>
                </details>
              )}

            </aside>
          </section>
        </section>
      </article>

      <Dialog open={isPixModalOpen} onOpenChange={setIsPixModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalize seu Pix</DialogTitle>
            <DialogDescription>
              Escaneia o QR Code com o aplicativo do seu banco ou usa o código Pix copia e cola abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {pixCode && (
              <div className="flex justify-center">
                {/* QR Code gerado no frontend a partir do pix_code retornado pela API */}
                <div className="h-48 w-48 rounded-xl border border-border/70 bg-background p-2 flex items-center justify-center">
                  <QRCode value={pixCode} size={176} />
                </div>
              </div>
            )}

            {pixCode && (
              <div className="space-y-2 text-xs sm:text-sm">
                <Label htmlFor="pix-code">Pix copia e cola</Label>
                <div className="flex gap-2">
                  <Input
                    id="pix-code"
                    readOnly
                    value={pixCode}
                    className="text-[11px] sm:text-xs"
                  />
                  <Button type="button" size="icon" variant="secondary" onClick={handleCopyPix}>
                    <ArrowRight className="h-4 w-4 rotate-90" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            )}

            {externalId && !vipToken && (
              <p className="text-[11px] text-muted-foreground">
                Assim que o pagamento for confirmado pela TriboPay, o sistema verifica automaticamente e libera seu acesso ao
                painel com o link do Discord e seu token exclusivo.
              </p>
            )}

            {vipToken && vipDiscordLink && (
              <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-muted/40 p-4 text-xs sm:text-sm">
                <p className="font-medium text-foreground">Pronto! Seu acesso VIP foi liberado.</p>
                <p>
                  <span className="font-semibold">1.</span> Entre no servidor clicando no link abaixo:
                </p>
                <p>
                  <a
                    href={vipDiscordLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-primary"
                  >
                    Acessar servidor VIP no Discord
                  </a>
                </p>
                <p>
                  <span className="font-semibold">2.</span> Use este token dentro do bot para ativar seu acesso:
                </p>
                <p className="break-all rounded-md bg-background px-3 py-2 font-mono text-[11px]">
                  {vipToken}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Guarde este token com cuidado. Ele é único e será invalidado pelo bot assim que for utilizado.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsPixModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default VipCommunity;
