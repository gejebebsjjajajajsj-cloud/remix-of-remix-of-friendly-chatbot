import { Link } from "react-router-dom";
import { ArrowRight, Crown, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import vipBanner from "@/assets/vip-community-banner.jpg";
import freeBanner from "@/assets/free-community-banner.png";
import profileAvatar from "@/assets/profile-avatar.png";

const Index = () => {
  useEffect(() => {
    document.title = "Link na Bio Premium | Seu Hub de Comunidades";
  }, []);

  return (
    <main className="page-shell">
      <section className="bio-card animate-fade-in">
        <header className="flex flex-col items-center text-center mb-6">
          <div className="avatar-ring hover-scale signature-glow overflow-hidden">
            <img
              src={profileAvatar}
              alt="Foto de perfil da sua marca"
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="banner-pill vip-chip mb-2">link na bio diferente de tudo</p>
          <h1 className="font-cartoon text-3xl sm:text-4xl text-foreground mb-1">
            Seu Nome {/* troque depois pelo seu nome/brand */}
          </h1>
          <p className="max-w-xl text-sm sm:text-base text-muted-foreground">
            Crio conteúdos todo santo dia para te tirar do amadorismo e colocar você em um jogo profissional de
            resultados. Aqui embaixo estão as portas de entrada para a minha comunidade.
          </p>
        </header>

        <section aria-label="Links principais" className="space-y-4">
          {/* Comunidade VIP - página interna */}
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
              nossa comunidade VIP
              <span aria-hidden="true" className="text-base leading-none">
                👇
              </span>
            </p>
            <Link
              to="/vip-comunidade"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
            >
              <article className="banner-card overflow-hidden p-0">
                <img
                  src={vipBanner}
                  alt="Banner da Comunidade VIP"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </article>
            </Link>
          </div>

          {/* Comunidade gratuita - link externo WhatsApp */}
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-medium text-foreground">nossa comunidade grátis no WhatsApp</p>
            <a
              href="https://wa.me/5500000000000" // troque pelo seu número/linha oficial
              target="_blank"
              rel="noopener noreferrer"
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
            >
              <article className="banner-card overflow-hidden p-0">
                <img
                  src={freeBanner}
                  alt="Banner da Comunidade Free no WhatsApp"
                  className="w-full h-auto object-cover"
                  loading="lazy"
                />
              </article>
            </a>
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-between text-[11px] sm:text-xs text-muted-foreground">
          <p>
            Feito para ser o <span className="story-link">link na bio mais diferente</span> que você já viu.
          </p>
          <p className="hidden sm:block">Atualize os textos, foto e links para deixar 100% com a sua cara.</p>
        </footer>
      </section>
    </main>
  );
};

export default Index;
