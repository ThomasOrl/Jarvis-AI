/**
 * Petits utilitaires de stockage local.
 *
 * Le navigateur peut refuser l'accès au localStorage (navigation privée, quota
 * atteint, rendu côté serveur où `window` n'existe pas). Ces deux fonctions
 * encapsulent ces cas pour que le reste de l'application n'ait jamais à faire
 * de `try / catch`.
 */

/** Lit une valeur JSON. Renvoie `fallback` si elle est absente ou illisible. */
export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Écrit une valeur JSON. Échoue silencieusement si le stockage est indisponible. */
export function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota atteint ou stockage refusé : on ignore, ce n'est pas critique */
  }
}

/** Supprime une préférence mémorisée sans faire échouer l'application. */
export function removeJson(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* stockage indisponible : aucune action */
  }
}
