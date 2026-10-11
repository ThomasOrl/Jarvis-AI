import type { UIMessage } from "ai";

export type SavedConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: UIMessage[];
};

export type ConversationArchive = {
  conversations: SavedConversation[];
  activeId: string;
};

const ARCHIVE_KEY = "jarvis-conversations-v1";
const LEGACY_KEY = "jarvis-conversation-v1";

export function isSavedConversation(value: unknown): value is SavedConversation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedConversation>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.updatedAt === "string" &&
    Array.isArray(item.messages)
  );
}

export function loadLocalArchive(): ConversationArchive {
  if (typeof window === "undefined") return { conversations: [], activeId: "" };
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (data && typeof data === "object") {
        const archive = data as Partial<ConversationArchive>;
        const conversations = Array.isArray(archive.conversations)
          ? archive.conversations.filter(isSavedConversation)
          : [];
        const activeId =
          typeof archive.activeId === "string" &&
          conversations.some((item) => item.id === archive.activeId)
            ? archive.activeId
            : conversations[0]?.id ?? "";
        return { conversations, activeId };
      }
    }

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    const messages: unknown = legacy ? JSON.parse(legacy) : [];
    if (Array.isArray(messages) && messages.length > 0) {
      const conversation: SavedConversation = {
        id: crypto.randomUUID(),
        title: "Conversation précédente",
        updatedAt: new Date().toISOString(),
        messages: messages as UIMessage[],
      };
      return { conversations: [conversation], activeId: conversation.id };
    }
  } catch {
    // Le stockage local peut être absent ou inaccessible.
  }
  return { conversations: [], activeId: "" };
}

export function saveLocalArchive(archive: ConversationArchive): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
  } catch {
    // Une conversation peut dépasser le quota du navigateur.
  }
}

