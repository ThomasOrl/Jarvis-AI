/**
 * Page d'accueil de J.A.R.V.I.S.
 *
 * Structure de l'écran : en-tête, réacteur et chat centrés, puis pied de page.
 *
 * Deux informations remontent du chat vers cette page :
 * - `thinking`   : une réponse est en cours → le réacteur « respire ».
 * - `conversing` : la conversation a commencé → la zone de conversation s'élargit.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Github, Linkedin } from "lucide-react";
import { useEffect, useState } from "react";

import { ArcReactor } from "@/components/jarvis/ArcReactor";
import { JarvisChat } from "@/components/jarvis/JarvisChat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  // Métadonnées affichées dans l'onglet du navigateur et sur les réseaux sociaux.
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S — Interface d'assistant holographique" },
      {
        name: "description",
        content:
          "Interface HUD futuriste inspirée de Jarvis : réacteur arc animé et assistant vocal en temps réel.",
      },
      { property: "og:title", content: "J.A.R.V.I.S — Interface d'assistant holographique" },
      {
        property: "og:description",
        content: "Interface HUD futuriste : réacteur arc animé et assistant vocal en temps réel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

/**
 * Horloge mise à jour chaque seconde.
 *
 * La valeur démarre à `null` : la date n'est lue qu'après l'affichage, côté
 * navigateur. Sinon le serveur et le navigateur afficheraient deux heures
 * différentes, ce que React signalerait comme une erreur.
 */
function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

function Home() {
  /** Jarvis prépare une réponse (anime le réacteur). */
  const [thinking, setThinking] = useState(false);
  /** Au moins un message échangé (élargit la zone de conversation). */
  const [conversing, setConversing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const now = useClock();
  const time = now
    ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const day = now ? now.toLocaleDateString("fr-FR", { weekday: "long" }) : "";
  const date = now
    ? now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <main
      className={cn(
        "relative z-[1] min-h-screen px-3 py-6 md:px-2",
        sidebarCollapsed ? "xl:pl-[4.25rem]" : "xl:pl-[17rem]",
      )}
    >
      <div className="hud-network-backdrop" aria-hidden="true">
        <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice">
          <g className="hud-backdrop-links">
            <path d="M40 180 220 110 390 240 570 120 770 225 980 110 1190 250 1400 140M0 570 190 430 390 590 600 410 820 580 1040 390 1240 560 1440 420M160 900 340 740 550 870 760 690 960 850 1160 700 1370 900M220 110 190 430 390 590 340 740M570 120 600 410 550 870M980 110 1040 390 960 850M1190 250 1240 560 1160 700" />
          </g>
          <g className="hud-backdrop-nodes">
            <circle cx="220" cy="110" r="3" />
            <circle cx="390" cy="240" r="2" />
            <circle cx="770" cy="225" r="3" />
            <circle cx="1190" cy="250" r="3" />
            <circle cx="190" cy="430" r="3" />
            <circle cx="600" cy="410" r="2" />
            <circle cx="820" cy="580" r="3" />
            <circle cx="1240" cy="560" r="2" />
            <circle cx="340" cy="740" r="2" />
            <circle cx="760" cy="690" r="3" />
            <circle cx="1160" cy="700" r="2" />
          </g>
        </svg>
      </div>
      {/* ---------- En-tête : identité à gauche, horloge à droite ---------- */}
      <header className="mx-auto flex max-w-[100rem] items-center justify-between border-b border-primary/20 pb-4">
        <div className="ml-[1cm]">
          <p className="font-display text-sm font-bold uppercase tracking-[0.4em] text-primary">
            Jarvis
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Just A Rather Very Intelligent System
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-2xl font-bold tabular-nums text-foreground hud-glow">
            {time}
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            {day} {date}
          </p>
        </div>
      </header>

      {/* ---------- Corps : réacteur et conversation centrés ---------- */}
      <div
        className={cn(
          "mt-10 flex w-full justify-center transition-[margin] duration-700",
          conversing && "mt-3",
        )}
      >
        <section
          className={cn(
            "mx-auto flex w-full flex-col items-center gap-10 pt-6 transition-all duration-700 lg:pt-14",
            // La zone s'élargit dès que la conversation démarre, en gardant une largeur lisible.
            conversing ? "max-w-[72rem] gap-5 pt-0 lg:pt-4" : "max-w-225",
          )}
        >
          <div
            className={cn(
              "w-full transition-[max-width] duration-700",
              conversing && "max-w-[min(62vw,22rem)]",
            )}
          >
            <ArcReactor thinking={thinking} />
          </div>
          <JarvisChat
            onThinkingChange={setThinking}
            onConversationChange={setConversing}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarCollapsedChange={setSidebarCollapsed}
          />
        </section>
      </div>

      <p className="mx-auto mt-10 max-w-[100rem] text-center text-xs leading-6 text-muted-foreground">
        Assistant IA personnel : échangez par texte ou dictée vocale et retrouvez vos conversations
        sur cet appareil ou dans votre espace privé Google Drive.
      </p>

      {/* ---------- Pied de page : signature, confidentialité et réseaux ---------- */}
      <footer className="mx-auto mt-4 flex max-w-[100rem] flex-wrap items-center justify-center gap-3 border-t border-primary/20 pt-4 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        <span>© {new Date().getFullYear()} By ThomasOrls</span>
        <span aria-hidden className="text-primary/50">
          ·
        </span>
        <Link
          to="/confidentialite"
          className="transition-colors hover:text-primary"
          aria-label="Politique de confidentialité de Jarvis"
        >
          Confidentialité
        </Link>
        <span aria-hidden className="text-primary/50">
          ·
        </span>
        <a
          href="https://www.linkedin.com/in/thomas-orlans-6a8434201/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          aria-label="LinkedIn de EasyToDev"
        >
          <Linkedin className="h-3.5 w-3.5" />
          <span>LinkedIn</span>
        </a>
        <a
          href="https://github.com/ThomasOrl"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
          aria-label="GitHub de EasyToDev"
        >
          <Github className="h-3.5 w-3.5" />
          <span>GitHub</span>
        </a>
      </footer>
    </main>
  );
}
