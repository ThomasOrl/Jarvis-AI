/**
 * Zone de conversation de Jarvis.
 *
 * Trois canaux se rejoignent ici :
 * - le texte    : écrit au clavier et envoyé à `/api/chat` (réponse en flux) ;
 * - la dictée   : `useDictation` enregistre le micro et renvoie le texte dicté ;
 * - la voix     : `useVoice` fait lire chaque nouvelle réponse à voix haute.
 *
 * Les conversations restent dans le navigateur en mode invité ou sont
 * synchronisées sur Google Drive après connexion.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  Copy,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MessageSquarePlus,
  Mic,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";

import { useDictation } from "@/hooks/use-dictation";
import { useVoice } from "@/hooks/use-voice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  loadLocalArchive,
  saveLocalArchive,
  isSavedConversation,
  type SavedConversation,
} from "@/lib/conversation-storage";
import {
  connectGoogle,
  loadCloudArchive,
  prepareGoogleIdentity,
  saveCloudArchive,
  type GoogleAccount,
} from "@/lib/google-drive";
import { readJson, removeJson, writeJson } from "@/lib/local-storage";
import { cn } from "@/lib/utils";

const VOICE_STORAGE_KEY = "jarvis-voice-enabled-v1";
const GOOGLE_ACCOUNT_STORAGE_KEY = "jarvis-google-account-v1";
const GOOGLE_ARCHIVE_STORAGE_PREFIX = "jarvis-google-conversations-v1:";
const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"]?.trim() ?? "";

/** Temps de « réflexion » avant l'envoi, pour l'effet Jarvis (ms). */
const THINKING_DELAY = 1600;

/** Hauteur maximale de la zone de saisie avant apparition d'un ascenseur (px). */
const TEXTAREA_MAX_HEIGHT = 180;

/** Un message est découpé en morceaux ; on ne garde que le texte lisible. */
function messageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function newConversation(): SavedConversation {
  return {
    id: crypto.randomUUID(),
    title: "Nouvelle conversation",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

function isGoogleAccount(value: unknown): value is GoogleAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<GoogleAccount>;
  return (
    typeof account.email === "string" &&
    typeof account.name === "string" &&
    (account.picture === undefined || typeof account.picture === "string")
  );
}

function loadGoogleArchive(email: string) {
  const archive = readJson<{ conversations?: unknown; activeId?: unknown } | null>(
    `${GOOGLE_ARCHIVE_STORAGE_PREFIX}${encodeURIComponent(email.toLowerCase())}`,
    null,
  );
  const conversations = Array.isArray(archive?.conversations)
    ? archive.conversations.filter(isSavedConversation)
    : [];
  const activeId =
    typeof archive?.activeId === "string" &&
    conversations.some((item) => item.id === archive.activeId)
      ? archive.activeId
      : (conversations[0]?.id ?? "");
  return { conversations, activeId };
}

function conversationTitle(messages: UIMessage[]) {
  const firstQuestion = messages.find((message) => message.role === "user");
  if (!firstQuestion) return "Nouvelle conversation";
  const title = messageText(firstQuestion).replace(/\s+/g, " ");
  return title.length > 54 ? `${title.slice(0, 51)}…` : title || "Nouvelle conversation";
}

function CopyableCodeBlock({ value, language }: { value: string; language?: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const lineCount = value.split("\n").length;

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copiedToClipboard = document.execCommand("copy");
        field.remove();
        if (!copiedToClipboard) throw new Error("La copie a échoué.");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-5 overflow-hidden border border-cyan-300/25 bg-[#031522]/95 shadow-[0_0_28px_oklch(0.7_0.16_210/8%)]">
      <div className="flex items-center justify-between border-b border-cyan-300/15 bg-cyan-300/[0.045] px-4 py-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/75">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_oklch(0.78_0.14_215/75%)]" />
          {language || "Extrait copiable"}
        </div>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copied ? "Code copié" : "Copier le code"}
          className="inline-flex items-center gap-1.5 border border-cyan-200/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-100/75 transition-colors hover:border-cyan-200/40 hover:bg-cyan-200/[0.08] hover:text-cyan-100"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="max-h-[min(55vh,34rem)] overflow-auto overscroll-contain px-4 py-4 font-mono text-[13px] leading-6 text-white [scrollbar-color:oklch(0.68_0.16_195/45%)_transparent] [scrollbar-width:thin] sm:px-5">
        <code style={{ color: "#fff" }}>{value}</code>
      </pre>
      {lineCount > 18 ? (
        <div className="flex items-center justify-between gap-3 border-t border-cyan-300/10 bg-black/15 px-4 py-2 font-mono text-[9px] uppercase tracking-wider text-cyan-100/55">
          <span>{lineCount} lignes</span>
          <span>Faites défiler le bloc · Copier prend tout le code</span>
        </div>
      ) : null}
    </div>
  );
}

function MarkdownPre({ children, ...props }: ComponentProps<"pre">) {
  const codeElement = Children.toArray(children).find(isValidElement);
  if (!codeElement) {
    return (
      <pre
        {...props}
        className="my-5 overflow-x-auto border border-cyan-300/25 bg-[#031522]/95 p-4"
      >
        {children}
      </pre>
    );
  }

  const codeProps = codeElement.props as { children?: ReactNode; className?: string };
  const value = Children.toArray(codeProps.children)
    .map((child) => (typeof child === "string" ? child : ""))
    .join("")
    .replace(/\n$/, "");
  const language = codeProps.className?.match(/language-([^\s]+)/)?.[1];
  return <CopyableCodeBlock value={value} language={language} />;
}

export function JarvisChat({
  onThinkingChange,
  onConversationChange,
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: {
  /** Prévient la page qu'une réponse est en préparation. */
  onThinkingChange?: (v: boolean) => void;
  /** Prévient la page que la conversation a commencé. */
  onConversationChange?: (active: boolean) => void;
  /** État de la barre latérale en mode bureau. */
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
}) {
  const [activeConversationId, setActiveConversationId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [initialMessages] = useState<UIMessage[]>([]);
  const [archiveHydrated, setArchiveHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [forceGoogleConsent, setForceGoogleConsent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<SavedConversation | null>(null);
  const [googleAccount, setGoogleAccount] = useState<GoogleAccount | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncLabel, setSyncLabel] = useState("MÉMOIRE LOCALE");
  /** Vrai pendant le délai de réflexion, avant l'appel au serveur. */
  const [pending, setPending] = useState(false);
  /** Lecture à voix haute activée (préférence mémorisée). */
  const [voiceOn, setVoiceOn] = useState(() => readJson(VOICE_STORAGE_KEY, true));

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) prepareGoogleIdentity();
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driveFileIdRef = useRef<string | null>(null);
  const lastSavedSnapshotRef = useRef(JSON.stringify(initialMessages));
  const observedConversationIdRef = useRef(activeConversationId);
  const saveQueueRef = useRef(Promise.resolve());
  /** Identifiants des réponses déjà lues à voix haute (évite les répétitions). */
  const spokenRef = useRef<Set<string>>(new Set());

  const { messages, sendMessage, regenerate, clearError, status, setMessages } = useChat({
    id: "jarvis",
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (e) => setError(e.message || "Liaison interrompue."),
  });

  /** La réponse est en train d'arriver du serveur. */
  const streaming = status === "submitted" || status === "streaming";
  /** Jarvis est occupé : réflexion ou réponse en cours. */
  const busy = pending || streaming;
  /** Le réacteur ne se compacte qu'au premier texte de la réponse. */
  const hasAssistantResponse = messages.some(
    (message) => message.role === "assistant" && messageText(message).length > 0,
  );
  const responseTextStarted =
    messages.at(-1)?.role === "assistant" && messageText(messages[messages.length - 1]!).length > 0;
  const reactorThinking = pending || (streaming && !responseTextStarted);
  const voice = useVoice();

  // --- Informations remontées à la page d'accueil ---------------------------

  useEffect(() => {
    onThinkingChange?.(reactorThinking);
  }, [onThinkingChange, reactorThinking]);

  useEffect(() => {
    onConversationChange?.(hasAssistantResponse);
  }, [hasAssistantResponse, onConversationChange]);

  /** Charge l'historique après l'hydratation pour garder le rendu serveur stable. */
  useEffect(() => {
    const archive = loadLocalArchive();
    const storedAccount = readJson<unknown>(GOOGLE_ACCOUNT_STORAGE_KEY, null);
    const rememberedAccount = isGoogleAccount(storedAccount) ? storedAccount : null;
    const rememberedArchive = rememberedAccount ? loadGoogleArchive(rememberedAccount.email) : null;
    const initialArchive = rememberedArchive?.conversations.length ? rememberedArchive : archive;
    const activeId = initialArchive.activeId || crypto.randomUUID();
    const active = initialArchive.conversations.find((item) => item.id === activeId);
    setConversations(initialArchive.conversations);
    setActiveConversationId(activeId);
    if (rememberedAccount) {
      setGoogleAccount(rememberedAccount);
      setSyncLabel("COMPTE MÉMORISÉ · RÉAUTORISATION REQUISE");
    }
    if (active) {
      spokenRef.current = new Set(active.messages.map((message) => message.id));
      setMessages(active.messages);
    }
    setArchiveHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /** Met à jour le titre et le contenu de la conversation quand elle est stable. */
  useEffect(() => {
    if (streaming) return;
    const snapshot = JSON.stringify(messages);
    if (observedConversationIdRef.current !== activeConversationId) {
      observedConversationIdRef.current = activeConversationId;
      lastSavedSnapshotRef.current = snapshot;
      return;
    }
    if (lastSavedSnapshotRef.current === snapshot) return;
    lastSavedSnapshotRef.current = snapshot;
    setConversations((current) => {
      const existing = current.find((item) => item.id === activeConversationId);
      if (!existing && messages.length === 0) return current;
      const updated: SavedConversation = {
        id: activeConversationId,
        title: conversationTitle(messages),
        updatedAt: new Date().toISOString(),
        messages,
      };
      return [updated, ...current.filter((item) => item.id !== activeConversationId)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
    });
  }, [activeConversationId, messages, streaming]);

  /** Conserve une copie locale pour restaurer l'interface avant la réautorisation Drive. */
  useEffect(() => {
    if (!archiveHydrated) return;
    const archive = { conversations, activeId: activeConversationId };
    if (!googleAccount) {
      saveLocalArchive(archive);
      return;
    }
    writeJson(
      `${GOOGLE_ARCHIVE_STORAGE_PREFIX}${encodeURIComponent(googleAccount.email.toLowerCase())}`,
      archive,
    );
  }, [activeConversationId, archiveHydrated, conversations, googleAccount]);

  /** Synchronise l'historique du compte Google après chaque réponse complète. */
  useEffect(() => {
    if (!googleToken || !cloudReady || streaming) return;
    const timeout = setTimeout(() => {
      syncTimerRef.current = null;
      setSyncLabel("SYNCHRONISATION…");
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          driveFileIdRef.current = await saveCloudArchive(
            googleToken,
            driveFileIdRef.current,
            conversations,
            activeConversationId,
          );
          setSyncLabel("SYNCHRONISÉ SUR GOOGLE DRIVE");
          setGoogleError(null);
        })
        .catch((cause: unknown) => {
          const message =
            cause instanceof Error ? cause.message : "Échec de la sauvegarde Google Drive.";
          setSyncLabel("SYNCHRONISATION EN ÉCHEC");
          setGoogleError(message);
        });
    }, 700);
    syncTimerRef.current = timeout;
    return () => {
      clearTimeout(timeout);
      if (syncTimerRef.current === timeout) syncTimerRef.current = null;
    };
  }, [activeConversationId, cloudReady, conversations, googleToken, streaming]);

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
      clearError();
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
    [busy, clearError, sendMessage, voice],
  );

  // La dictée envoie directement la phrase reconnue.
  const dictation = useDictation(useCallback((text: string) => submit(text), [submit]));
  const recording = dictation.state === "recording";
  const transcribing = dictation.state === "transcribing";

  /** Efface la conversation, à l'écran et dans le navigateur. */
  const reset = () => {
    const next = newConversation();
    setMessages([]);
    setActiveConversationId(next.id);
    setConversations((current) => [
      next,
      ...current.filter((item) => item.id !== activeConversationId),
    ]);
    setError(null);
    clearError();
    voice.stop();
  };

  const startConversation = () => {
    if (busy) return;
    const conversation = newConversation();
    setActiveConversationId(conversation.id);
    setConversations((current) => [conversation, ...current]);
    setMessages([]);
    setError(null);
    setGoogleError(null);
    setSidebarOpen(false);
    clearError();
  };

  const openConversation = (conversation: SavedConversation) => {
    if (busy || conversation.id === activeConversationId) return;
    voice.stop();
    spokenRef.current = new Set(conversation.messages.map((message) => message.id));
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setError(null);
    setSidebarOpen(false);
    clearError();
  };

  const deleteConversation = (conversation: SavedConversation) => {
    if (busy || authBusy) return;
    setConversationToDelete(conversation);
  };

  const confirmDeleteConversation = () => {
    if (!conversationToDelete) return;
    const remaining = conversations.filter((item) => item.id !== conversationToDelete.id);
    setConversations(remaining);
    if (conversationToDelete.id === activeConversationId) {
      const next = remaining[0];
      voice.stop();
      setMessages(next?.messages ?? []);
      setActiveConversationId(next?.id ?? crypto.randomUUID());
      spokenRef.current = new Set(next?.messages.map((message) => message.id) ?? []);
      setError(null);
      clearError();
    }
    setConversationToDelete(null);
  };

  const signInWithGoogle = async (requestConsent = forceGoogleConsent) => {
    if (busy || authBusy) return;
    if (!GOOGLE_CLIENT_ID) {
      setGoogleError("Connexion Google non configurée : définissez VITE_GOOGLE_CLIENT_ID.");
      return;
    }
    setAuthBusy(true);
    setGoogleError(null);
    try {
      const { token, account } = await connectGoogle(
        GOOGLE_CLIENT_ID,
        requestConsent ? "consent select_account" : "select_account",
      );
      const cloud = await loadCloudArchive(token);
      const isSameAccount = googleAccount?.email.toLowerCase() === account.email.toLowerCase();
      const accountArchive = loadGoogleArchive(account.email);
      const fallbackConversations = googleAccount
        ? isSameAccount
          ? conversations
          : accountArchive.conversations
        : conversations;
      const saved = cloud.fileId ? cloud.conversations : fallbackConversations;
      const records = saved.length > 0 ? saved : [newConversation()];
      const active = records.find((item) => item.id === cloud.activeId) ?? records[0]!;
      driveFileIdRef.current = cloud.fileId;
      setConversations(records);
      setActiveConversationId(active.id);
      setMessages(active.messages);
      spokenRef.current = new Set(active.messages.map((message) => message.id));
      setGoogleAccount(account);
      setForceGoogleConsent(false);
      writeJson(GOOGLE_ACCOUNT_STORAGE_KEY, account);
      setGoogleToken(token);
      setCloudReady(true);
      setSyncLabel(cloud.fileId ? "HISTORIQUE GOOGLE CHARGÉ" : "PRÉPARATION DE LA MÉMOIRE GOOGLE");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "La connexion Google a échoué.";
      if (/Réautoriser Google Drive/i.test(message)) setForceGoogleConsent(true);
      setGoogleError(message);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutGoogle = async () => {
    const token = googleToken;
    if (busy || authBusy) return;
    setAuthBusy(true);
    if (token && cloudReady) {
      try {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
        await saveQueueRef.current;
        driveFileIdRef.current = await saveCloudArchive(
          token,
          driveFileIdRef.current,
          conversations,
          activeConversationId,
        );
      } catch (cause) {
        setGoogleError(
          cause instanceof Error
            ? cause.message
            : "Impossible de sauvegarder avant la déconnexion.",
        );
        setSyncLabel("SYNCHRONISATION EN ÉCHEC");
        setAuthBusy(false);
        return;
      }
    }
    removeJson(GOOGLE_ACCOUNT_STORAGE_KEY);
    setGoogleAccount(null);
    setGoogleToken(null);
    setCloudReady(false);
    driveFileIdRef.current = null;
    const guestArchive = loadLocalArchive();
    const guestId = guestArchive.activeId || crypto.randomUUID();
    spokenRef.current = new Set(
      (guestArchive.conversations.find((item) => item.id === guestId)?.messages ?? []).map(
        (message) => message.id,
      ),
    );
    setConversations(guestArchive.conversations);
    setActiveConversationId(guestId);
    setMessages(guestArchive.conversations.find((item) => item.id === guestId)?.messages ?? []);
    setGoogleError(null);
    setSyncLabel("MÉMOIRE LOCALE");
    setAuthBusy(false);
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

  /** Relance la réponse à partir des messages déjà conservés dans la conversation. */
  const retryLastQuestion = () => {
    setError(null);
    clearError();
    void regenerate();
  };

  return (
    <div className="w-full">
      <AlertDialog
        open={conversationToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConversationToDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-md overflow-hidden rounded-none border border-primary/35 bg-[#03101b] p-0 text-foreground shadow-[0_0_60px_oklch(0.7_0.16_210/18%)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-primary/80">
          <div className="absolute right-0 top-0 h-24 w-24 bg-[radial-gradient(circle_at_top_right,oklch(0.65_0.16_25/12%),transparent_70%)]" />
          <AlertDialogHeader className="relative gap-4 px-6 pb-5 pt-7 text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-content-center border border-destructive/35 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-destructive/80">
                  Confirmation requise
                </p>
                <AlertDialogTitle className="mt-1 font-display text-base font-semibold tracking-wide text-foreground">
                  Supprimer cette conversation ?
                </AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="border-l border-primary/25 pl-3 font-sans text-sm leading-relaxed text-muted-foreground">
              <span className="mb-1 block text-foreground/90">
                {conversationToDelete?.title || "Nouvelle conversation"}
              </span>
              Elle sera supprimée de votre historique local et de Google Drive. Cette opération est
              définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="relative border-t border-primary/15 bg-black/20 px-6 py-4">
            <AlertDialogCancel className="h-9 rounded-none border-primary/20 bg-transparent font-sans text-xs text-muted-foreground hover:border-primary/45 hover:bg-primary/[0.06] hover:text-foreground">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteConversation}
              className="h-9 rounded-none border border-destructive/45 bg-destructive/10 font-sans text-xs text-destructive shadow-none hover:bg-destructive/20 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Fermer l’historique des conversations"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] xl:hidden"
        />
      ) : null}

      <aside
        id="jarvis-conversation-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-primary/20 bg-background/95 px-4 pb-4 pt-6 shadow-[16px_0_48px_oklch(0.02_0.04_250/35%)] backdrop-blur-xl transition-[width,transform,padding] duration-300 xl:translate-x-0",
          sidebarCollapsed ? "xl:w-[4.25rem] xl:px-2" : "xl:w-[17rem]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "mb-8 flex items-center justify-between border-b border-primary/15 pb-4",
            sidebarCollapsed && "xl:justify-center",
          )}
        >
          <div className={cn(sidebarCollapsed && "xl:hidden")}>
            <p className="font-display text-xs font-bold uppercase tracking-[0.26em] text-primary">
              J.A.R.V.I.S
            </p>
            <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
              Mémoire personnelle
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSidebarCollapsedChange(!sidebarCollapsed)}
            aria-label={
              sidebarCollapsed ? "Déplier la barre latérale" : "Replier la barre latérale"
            }
            title={sidebarCollapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
            className="hidden h-8 w-8 place-content-center text-muted-foreground transition-colors hover:text-primary xl:grid"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer la barre latérale"
            className="grid h-8 w-8 place-content-center text-muted-foreground transition-colors hover:text-primary xl:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col", sidebarCollapsed && "xl:hidden")}>
          {googleAccount ? (
            <div className="mb-4 flex items-center gap-2.5">
              {googleAccount.picture ? (
                <img
                  src={googleAccount.picture}
                  alt=""
                  className="h-8 w-8 rounded-full border border-primary/30"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid h-8 w-8 place-content-center rounded-full bg-primary/10 font-mono text-xs text-primary">
                  {googleAccount.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-sans text-xs text-foreground">{googleAccount.name}</p>
                <p className="truncate font-mono text-[9px] text-muted-foreground">
                  {googleAccount.email}
                </p>
              </div>
              <button
                type="button"
                onClick={signOutGoogle}
                disabled={authBusy || busy}
                title="Déconnecter Google"
                aria-label="Déconnecter Google"
                className="grid h-8 w-8 shrink-0 place-content-center text-muted-foreground transition-colors hover:text-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authBusy || busy || !archiveHydrated}
              className="mb-4 flex w-full items-center justify-center gap-2 border border-primary/25 bg-primary/[0.04] px-3 py-2.5 font-sans text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-primary/[0.08] disabled:opacity-60"
            >
              {authBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 text-primary" />
              )}
              {forceGoogleConsent ? "Réautoriser Google Drive" : "Se connecter avec Google"}
            </button>
          )}

          <button
            type="button"
            onClick={startConversation}
            disabled={busy}
            className="mb-4 flex w-full items-center gap-2 border border-primary/20 px-3 py-2.5 text-left font-sans text-xs text-primary transition-colors hover:border-primary/45 hover:bg-primary/[0.04] hover:text-foreground disabled:opacity-40"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Nouvelle conversation
          </button>

          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Historique <span className="text-primary/70">/{conversations.length}</span>
            </p>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {conversations.length === 0 ? (
                <p className="py-3 font-sans text-xs leading-relaxed text-muted-foreground">
                  Vos échanges apparaîtront ici.
                </p>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => openConversation(conversation)}
                      disabled={busy}
                      className={cn(
                        "min-w-0 flex-1 border-l-2 px-2.5 py-2 text-left transition-colors disabled:opacity-50",
                        conversation.id === activeConversationId
                          ? "border-primary bg-primary/[0.07] text-foreground"
                          : "border-transparent text-muted-foreground hover:border-primary/30 hover:bg-white/[0.025] hover:text-foreground",
                      )}
                    >
                      <span className="block truncate font-sans text-xs">
                        {conversation.title || "Nouvelle conversation"}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground/75">
                        <Clock3 className="h-3 w-3" />
                        {new Date(conversation.updatedAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(conversation)}
                      disabled={busy || authBusy}
                      aria-label={`Supprimer la conversation « ${conversation.title || "Nouvelle conversation"} »`}
                      title="Supprimer cette conversation"
                      className="ml-1 grid h-8 w-8 shrink-0 place-content-center text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </nav>
          </div>

          <p className="mt-4 border-t border-primary/10 pt-3 font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground/75">
            {googleAccount ? syncLabel : "MÉMOIRE SUR CET APPAREIL"}
          </p>
          {googleAccount && !googleToken ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authBusy || busy}
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-primary hover:text-foreground disabled:opacity-50"
            >
              {authBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <LogIn className="h-3 w-3" />
              )}
              {forceGoogleConsent
                ? "Réautoriser Google Drive"
                : "Réautoriser Google pour synchroniser"}
            </button>
          ) : null}
          {googleError ? (
            <div>
              <p
                role="status"
                className="break-words font-sans text-[11px] leading-relaxed text-destructive"
              >
                {googleError}
              </p>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between xl:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-expanded={sidebarOpen}
            aria-controls="jarvis-conversation-sidebar"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 font-sans text-xs text-foreground transition-colors hover:border-primary/45 hover:bg-primary/[0.05]"
          >
            <Menu className="h-4 w-4 text-primary" />
            Historique
          </button>
          <button
            type="button"
            onClick={startConversation}
            disabled={busy}
            aria-label="Nouvelle conversation"
            className="grid h-9 w-9 place-content-center rounded-lg border border-primary/20 text-primary transition-colors hover:border-primary/45 hover:bg-primary/[0.05] disabled:opacity-40"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>
        {/* ---------- Accueil, puis historique des messages ---------- */}
        {messages.length === 0 ? (
          <p className="animate-fade-in px-3 text-center font-sans text-lg font-medium leading-relaxed text-foreground sm:text-xl">
            Bonjour Monsieur... Comment puis-je vous aider aujourd'hui ?
          </p>
        ) : (
          <div
            ref={scrollRef}
            className="max-h-[min(60vh,38rem)] space-y-6 overflow-y-auto px-2 py-2 text-left sm:space-y-8 sm:px-4"
          >
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
                        ? "max-w-[82%] rounded-tr-sm border-primary/25 bg-primary/9 text-foreground"
                        : "rounded-tl-sm border-white/8 bg-white/[0.035] text-foreground",
                    )}
                  >
                    <p className="mb-2 font-display text-[9px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                      {mine ? "Vous" : "J.A.R.V.I.S"}
                    </p>
                    {/* Les réponses peuvent contenir du markdown (listes, code). */}
                    <div className="prose max-w-none font-sans text-[15px] leading-7 prose-invert prose-p:my-3 prose-p:leading-7 prose-headings:mb-3 prose-headings:mt-5 prose-headings:font-sans prose-headings:text-primary prose-a:text-primary prose-strong:text-foreground prose-code:text-accent prose-li:my-1.5 sm:text-base sm:leading-8 sm:prose-p:leading-8">
                      <ReactMarkdown
                        components={{
                          pre: MarkdownPre,
                          code: ({ children, className, ...props }) => (
                            <code
                              {...props}
                              className={cn(
                                "rounded-sm bg-cyan-300/[0.09] px-1.5 py-0.5 font-mono text-[0.9em] text-white ring-1 ring-inset ring-cyan-200/15",
                                className,
                              )}
                            >
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {text}
                      </ReactMarkdown>
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
          <div className="animate-fade-in mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-sans text-sm text-destructive">
              {dictation.error ?? error ?? voice.error}
            </p>
            {error ? (
              <button
                type="button"
                onClick={retryLastQuestion}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/25 px-3 py-2 font-sans text-sm text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Réessayer la question
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
