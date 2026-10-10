/**
 * Zone de conversation de Jarvis.
 *
 * Trois canaux se rejoignent ici :
 * - le texte    : écrit au clavier et envoyé à `/api/chat` (réponse en flux) ;
 * - la dictée   : `useDictation` enregistre le micro et renvoie le texte dicté ;
 * - la voix     : `useVoice` fait lire chaque nouvelle réponse à voix haute.
 *
 * La conversation est conservée dans le navigateur : on la retrouve au retour
 * sur la page, et le bouton « Effacer » la supprime.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Mic, Send, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { useDictation } from "@/hooks/use-dictation";
import { useVoice } from "@/hooks/use-voice";
import { readJson, writeJson } from "@/lib/local-storage";
import { cn } from "@/lib/utils";

/** Clés de sauvegarde dans le navigateur. */
const STORAGE_KEY = "jarvis-conversation-v1";
const VOICE_STORAGE_KEY = "jarvis-voice-enabled-v1";

/** Temps de « réflexion » avant l'envoi, pour l'effet Jarvis (ms). */
const THINKING_DELAY = 1600;

/** Hauteur maximale de la zone de saisie avant apparition d'un ascenseur (px). */
const TEXTAREA_MAX_HEIGHT = 180;

/** Restaure la conversation précédente. */
function loadMessages(): UIMessage[] {
  const saved = readJson<UIMessage[]>(STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

/** Un message est découpé en morceaux ; on ne garde que le texte lisible. */
function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function JarvisChat({
  onThinkingChange,
  onConversationChange,
}: {
  /** Prévient la page qu'une réponse est en préparation. */
  onThinkingChange?: (v: boolean) => void;
  /** Prévient la page que la conversation a commencé. */
  onConversationChange?: (active: boolean) => void;
}) {
  const [initialMessages] = useState<UIMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Vrai pendant le délai de réflexion, avant l'appel au serveur. */
  const [pending, setPending] = useState(false);
  /** Lecture à voix haute activée (préférence mémorisée). */
  const [voiceOn, setVoiceOn] = useState(() => readJson(VOICE_STORAGE_KEY, true));

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Identifiants des réponses déjà lues à voix haute (évite les répétitions). */
  const spokenRef = useRef<Set<string>>(new Set());

  const { messages, sendMessage, status, setMessages } = useChat({
    id: "jarvis",
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message || "Liaison interrompue."),
  });

  /** La réponse est en train d'arriver du serveur. */
  const streaming = status === "submitted" || status === "streaming";
  /** Jarvis est occupé : réflexion ou réponse en cours. */
  const busy = pending || streaming;
  const voice = useVoice();

  // --- Informations remontées à la page d'accueil ---------------------------

  useEffect(() => {
    onThinkingChange?.(busy);
  }, [busy, onThinkingChange]);

  useEffect(() => {
    onConversationChange?.(messages.length > 0);
  }, [messages.length, onConversationChange]);

  // --- Effets techniques ---------------------------------------------------

  /** Annule le compte à rebours si le composant disparaît. */
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  /** Les messages restaurés au chargement ne doivent pas être relus à voix haute. */
  useEffect(() => {
    messages.forEach((m) => spokenRef.current.add(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mémorise la préférence de voix. */
  useEffect(() => {
    writeJson(VOICE_STORAGE_KEY, voiceOn);
  }, [voiceOn]);

  /** Lit à voix haute chaque nouvelle réponse, une fois celle-ci complète. */
  useEffect(() => {
    if (streaming || !voiceOn) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || spokenRef.current.has(last.id)) return;
    const text = messageText(last);
    if (!text) return;
    spokenRef.current.add(last.id);
    void voice.speak(text);
  }, [messages, streaming, voiceOn, voice]);

  /** Sauvegarde la conversation quand elle est stable (hors flux). */
  useEffect(() => {
    if (streaming) return;
    writeJson(STORAGE_KEY, messages);
  }, [messages, streaming]);

  /** Garde le dernier message visible. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /** La zone de saisie grandit avec le texte, jusqu'à une hauteur maximale. */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [input]);

  // --- Actions -------------------------------------------------------------

  /** Envoie une question après le court temps de réflexion. */
  const submit = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy) return;

      setError(null);
      voice.stop();
      // Le clic autorise l'audio : on en profite pour préparer le lecteur.
      void voice.unlock();
      setInput("");
      setPending(true);

      timerRef.current = setTimeout(() => {
        setPending(false);
        void sendMessage({ text: value });
      }, THINKING_DELAY);
    },
    [busy, sendMessage, voice],
  );

  // La dictée envoie directement la phrase reconnue.
  const dictation = useDictation(useCallback((text: string) => submit(text), [submit]));
  const recording = dictation.state === "recording";
  const transcribing = dictation.state === "transcribing";

  /** Efface la conversation, à l'écran et dans le navigateur. */
  const reset = () => {
    setMessages([]);
    setError(null);
    voice.stop();
    writeJson(STORAGE_KEY, []);
  };

  /** Active ou coupe la voix de Jarvis. */
  const toggleVoice = () => {
    if (voiceOn) {
      setVoiceOn(false);
      voice.stop();
      return;
    }
    voice.setError(null);
    void voice.unlock();
    setVoiceOn(true);
  };

  return (
    <div className="w-full">
      {/* ---------- Accueil, puis historique des messages ---------- */}
      {messages.length === 0 ? (
        <p className="animate-fade-in px-3 text-center font-sans text-lg font-medium leading-relaxed text-foreground sm:text-xl">
          Bonjour Monsieur... Comment puis-je vous aider aujourd'hui ?
        </p>
      ) : (
        <div ref={scrollRef} className="max-h-[min(60vh,38rem)] space-y-6 overflow-y-auto px-2 py-2 text-left sm:space-y-8 sm:px-4">
          {messages.map((message) => {
            const text = messageText(message);
            if (!text) return null;
            const mine = message.role === "user";
            return (
              <div
                key={message.id}
                className={cn("animate-fade-in flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[94%] rounded-2xl border px-5 py-4 font-sans text-[15px] leading-7 shadow-lg shadow-black/10 sm:px-6 sm:py-5 sm:text-base sm:leading-8",
                    mine
                      ? "max-w-[82%] rounded-tr-sm border-primary/25 bg-primary/[0.09] text-foreground"
                      : "rounded-tl-sm border-white/[0.08] bg-white/[0.035] text-foreground",
                  )}
                >
                  <p className="mb-2 font-display text-[9px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                    {mine ? "Vous" : "J.A.R.V.I.S"}
                  </p>
                  {/* Les réponses peuvent contenir du markdown (listes, code). */}
                  <div className="prose max-w-none font-sans text-[15px] leading-7 prose-invert prose-p:my-3 prose-p:leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-sans prose-headings:text-primary prose-a:text-primary prose-strong:text-foreground prose-code:text-accent prose-li:my-1.5 sm:text-base sm:leading-8 sm:prose-p:leading-8">
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {busy ? (
            <p className="px-2 font-sans text-sm font-medium text-primary hud-pulse">
              Jarvis prépare sa réponse…
            </p>
          ) : null}
        </div>
      )}

      {/* ---------- Barre de saisie : texte, micro, voix, envoi ---------- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className={cn(
          "group mt-8 flex items-end gap-3 rounded-2xl border bg-background/70 px-3 py-3 shadow-[0_12px_36px_oklch(0.02_0.04_250/25%)] backdrop-blur-md transition-all duration-300 sm:px-4",
          recording
            ? "border-accent/70 shadow-[0_0_24px_oklch(0.68_0.16_195/14%)]"
            : "border-primary/20 hover:border-primary/40 focus-within:border-primary/55",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée passe à la ligne.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          placeholder={recording ? "Je vous écoute, Monsieur…" : "Posez votre question…"}
          className="max-h-45 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 font-sans text-base leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-none"
        />

        {/* Micro : démarre / arrête la dictée */}
        <button
          type="button"
          onClick={dictation.toggle}
          disabled={transcribing}
          aria-label={recording ? "Arrêter la dictée" : "Dicter au micro"}
          title={recording ? "Arrêter la dictée" : "Dicter au micro"}
          className={cn(
            "relative grid h-9 w-9 shrink-0 place-content-center rounded-full transition-all duration-300 disabled:opacity-50",
            recording
              ? "bg-accent/20 text-accent"
              : "text-muted-foreground hover:scale-110 hover:bg-primary/10 hover:text-primary",
          )}
        >
          {recording ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full border border-accent/50" />
              <Square className="h-4 w-4 fill-current" />
            </>
          ) : transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>

        {/* Haut-parleur : active ou coupe la voix de Jarvis */}
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voiceOn ? "Couper la voix de Jarvis" : "Faire parler Jarvis"}
          title={voiceOn ? "Couper la voix de Jarvis" : "Faire parler Jarvis"}
          className={cn(
            "relative grid h-9 w-9 shrink-0 place-content-center rounded-full transition-all duration-300",
            voice.speaking
              ? "bg-accent/20 text-accent"
              : voiceOn
                ? "text-primary"
                : "text-muted-foreground hover:scale-110 hover:bg-primary/10 hover:text-primary",
          )}
        >
          {voice.speaking ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full border border-accent/50" />
              <Volume2 className="h-4 w-4" />
            </>
          ) : voiceOn ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
        </button>

        {/* Envoi */}
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Envoyer"
          title="Envoyer"
          className="grid h-9 w-9 shrink-0 place-content-center rounded-full text-primary transition-all duration-300 hover:scale-110 hover:bg-primary/10 hover:shadow-[0_0_18px_oklch(0.78_0.14_215/25%)] disabled:opacity-30 disabled:hover:scale-100"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4 transition-transform duration-200 hover:translate-x-0.5" />
          )}
        </button>
      </form>

      {/* ---------- Effacer la conversation ---------- */}
      {messages.length > 0 ? (
        <button
          type="button"
          onClick={reset}
          className="mt-3 flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:text-primary"
        >
          <Trash2 className="h-3 w-3 transition-transform duration-200 hover:-rotate-12" />
          Effacer
        </button>
      ) : null}

      {/* ---------- Message d'erreur (dictée, chat ou voix) ---------- */}
      {dictation.error || error || voice.error ? (
        <p className="animate-fade-in mt-3 text-xs uppercase tracking-widest text-destructive">
          {dictation.error ?? error ?? voice.error}
        </p>
      ) : null}
    </div>
  );
}
