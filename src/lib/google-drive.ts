import { isSavedConversation, type SavedConversation } from "@/lib/conversation-storage";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_FILE_NAME = "jarvis-conversations-v1.json";
const GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive.appdata";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
      revoke: (token: string, callback?: () => void) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export type GoogleAccount = { email: string; name: string; picture?: string };

export type CloudArchive = {
  conversations: SavedConversation[];
  fileId: string | null;
  activeId: string | null;
};

let googleScriptPromise: Promise<GoogleIdentity> | undefined;

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = window.google;
  if (existing?.accounts.oauth2) return Promise.resolve(existing);
  if (!googleScriptPromise) {
    const scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const loaded = window.google;
        if (loaded?.accounts.oauth2) resolve(loaded);
        else reject(new Error("Le service de connexion Google n’a pas pu démarrer."));
      };
      script.onerror = () => reject(new Error("Impossible de charger la connexion Google."));
      document.head.appendChild(script);
    });
    googleScriptPromise = scriptPromise.catch((error: unknown) => {
      googleScriptPromise = undefined;
      throw error;
    });
  }
  return googleScriptPromise;
}

/** Charge GIS avant le clic pour que la demande OAuth garde le geste utilisateur. */
export function prepareGoogleIdentity(): void {
  void loadGoogleIdentity().catch(() => undefined);
}

export async function connectGoogle(
  clientId: string,
  prompt = "select_account",
): Promise<{ token: string; account: GoogleAccount }> {
  const google = await loadGoogleIdentity();
  const token = await new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else
          reject(
            new Error(response.error_description ?? response.error ?? "Connexion Google refusée."),
          );
      },
    });
    client.requestAccessToken({ prompt });
  });

  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Impossible de récupérer le profil Google.");
  const profile = (await response.json()) as { email?: string; name?: string; picture?: string };
  if (!profile.email) throw new Error("Le compte Google n’a pas fourni d’adresse e-mail.");
  return {
    token,
    account: {
      email: profile.email,
      name: profile.name ?? profile.email,
      ...(profile.picture ? { picture: profile.picture } : {}),
    },
  };
}

async function driveRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...init,
    headers,
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("La session Google a expiré. Reconnectez votre compte.");
    const detail = await response.text();
    if (
      response.status === 403 &&
      /insufficient authentication scopes|insufficientpermissions/i.test(detail)
    ) {
      throw new Error(
        "Google n’a pas accordé l’accès à Drive. Réessayez avec « Réautoriser Google Drive » et acceptez l’accès demandé.",
      );
    }
    throw new Error(`Google Drive (${response.status}) : ${detail.slice(0, 180)}`);
  }
  return (await response.json()) as T;
}

async function findArchiveFile(token: string): Promise<string | null> {
  const query = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${DRIVE_FILE_NAME}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: "1",
  });
  const result = await driveRequest<{ files?: Array<{ id: string }> }>(
    token,
    `https://www.googleapis.com/drive/v3/files?${query}`,
  );
  return result.files?.[0]?.id ?? null;
}

export async function loadCloudArchive(token: string): Promise<CloudArchive> {
  const fileId = await findArchiveFile(token);
  if (!fileId) return { conversations: [], fileId: null, activeId: null };
  const payload = await driveRequest<{ conversations?: unknown; activeId?: unknown }>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  const conversations = Array.isArray(payload.conversations)
    ? payload.conversations.filter(isSavedConversation)
    : [];
  const activeId =
    typeof payload.activeId === "string" &&
    conversations.some((item) => item.id === payload.activeId)
      ? payload.activeId
      : (conversations[0]?.id ?? null);
  return { conversations, fileId, activeId };
}

export async function saveCloudArchive(
  token: string,
  fileId: string | null,
  conversations: SavedConversation[],
  activeId: string,
): Promise<string> {
  const content = JSON.stringify({ version: 1, conversations, activeId });
  if (fileId) {
    const updated = await driveRequest<{ id: string }>(
      token,
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: content },
    );
    return updated.id;
  }

  const boundary = `jarvis_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: DRIVE_FILE_NAME,
    mimeType: "application/json",
    parents: ["appDataFolder"],
  });
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`,
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}`,
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const created = await driveRequest<{ id: string }>(
    token,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return created.id;
}

export async function revokeGoogle(token: string): Promise<void> {
  const google = await loadGoogleIdentity();
  await new Promise<void>((resolve) => google.accounts.oauth2.revoke(token, resolve));
}
