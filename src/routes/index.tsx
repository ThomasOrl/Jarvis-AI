/**
 * Page d'accueil de J.A.R.V.I.S.
 *
 * Structure de l'écran :
 *   ┌──────────────── en-tête : logo + horloge ────────────────┐
 *   │ colonne gauche │      réacteur + chat      │ colonne droite │
 *   └──────────────────────────────────────────────────────────┘
 *
 * - Colonnes latérales : les quatre modules (météo, agenda, cryptos, bourse).
 * - Colonne centrale  : le réacteur animé et la zone de conversation.
 *
 * Deux informations remontent du chat vers cette page :
 * - `thinking`   : une réponse est en cours → le réacteur « respire ».
 * - `conversing` : la conversation a commencé → la colonne centrale s'élargit.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Github, Linkedin } from "lucide-react";
import { useEffect, useState } from "react";

import { ArcReactor } from "@/components/jarvis/ArcReactor";
import { JarvisChat } from "@/components/jarvis/JarvisChat";
import { WidgetColumn } from "@/components/jarvis/WidgetRail";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  // Métadonnées affichées dans l'onglet du navigateur et sur les réseaux sociaux.
  head: () => ({
    meta: [
      { title: "J.A.R.V.I.S — Interface d'assistant holographique" },
      {
        name: "description",
        content:
          "Interface HUD futuriste inspirée de Jarvis : réacteur arc animé, modules système, diagnostics et flux vocal en temps réel.",
      },
      { property: "og:title", content: "J.A.R.V.I.S — Interface d'assistant holographique" },
      {
        property: "og:description",
        content:
          "Tableau de bord HUD futuriste : réacteur arc animé, diagnostics système et flux vocal en temps réel.",
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
  /** Au moins un message échangé (élargit la colonne centrale). */
  const [conversing, setConversing] = useState(false);

  const now = useClock();
  const time = now
    ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";
  const day = now ? now.toLocaleDateString("fr-FR", { weekday: "long" }) : "";
  const date = now
    ? now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <main className="relative z-[1] min-h-screen px-4 py-6 md:px-8">
      <div className="hud-network-backdrop" aria-hidden="true">
        <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice">
          <g className="hud-backdrop-links">
            <path d="M40 180 220 110 390 240 570 120 770 225 980 110 1190 250 1400 140M0 570 190 430 390 590 600 410 820 580 1040 390 1240 560 1440 420M160 900 340 740 550 870 760 690 960 850 1160 700 1370 900M220 110 190 430 390 590 340 740M570 120 600 410 550 870M980 110 1040 390 960 850M1190 250 1240 560 1160 700" />
          </g>
          <g className="hud-backdrop-nodes">
            <circle cx="220" cy="110" r="3" /><circle cx="390" cy="240" r="2" />
            <circle cx="770" cy="225" r="3" /><circle cx="1190" cy="250" r="3" />
            <circle cx="190" cy="430" r="3" /><circle cx="600" cy="410" r="2" />
            <circle cx="820" cy="580" r="3" /><circle cx="1240" cy="560" r="2" />
            <circle cx="340" cy="740" r="2" /><circle cx="760" cy="690" r="3" />
            <circle cx="1160" cy="700" r="2" />
          </g>
        </svg>
      </div>
      {/* ---------- En-tête : identité à gauche, horloge à droite ---------- */}
      <header className="mx-auto flex max-w-375 items-center justify-between border-b border-primary/20 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-content-center rounded-full border border-primary/50 text-primary hud-glow">
            <span className="h-2.5 w-2.5 rounded-full bg-primary hud-pulse" />
          </span>
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-[0.4em] text-primary">
              Jarvis
            </p>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Just A Rather Very Intelligent System
            </p>
          </div>
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

      {/*
        ---------- Corps : trois colonnes sur grand écran ----------
        Sur mobile la grille passe sur une seule colonne ; les classes `order-*`
        placent alors le réacteur en premier, puis les modules.
      */}
      <div className="mx-auto mt-8 grid max-w-375 grid-cols-1 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <WidgetColumn side="left" className="order-2 lg:order-1" />

        <section
          className={cn(
            "order-1 mx-auto flex w-full flex-col items-center gap-10 pt-6 transition-all duration-700 lg:order-2 lg:pt-14",
            // La zone s'élargit dès que la conversation démarre.
            conversing ? "max-w-none" : "max-w-225",
          )}
        >
          <ArcReactor thinking={thinking} />
          <JarvisChat onThinkingChange={setThinking} onConversationChange={setConversing} />
        </section>

        <WidgetColumn side="right" className="order-3" />
      </div>

      {/* ---------- Pied de page : signature + LinkedIn ---------- */}
      <footer className="mx-auto mt-12 flex max-w-375 items-center justify-center gap-3 border-t border-primary/20 pt-4 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        <span>© {new Date().getFullYear()} By ThomasOrls</span>
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
