import { useSyncExternalStore } from 'react';
import { db } from './db';
import { programJson } from './program';
import readme from './data-readme.md?raw';
import type { Settings } from './types';

export interface SyncState { pending: number; busy: boolean; error: string | null; configured: boolean }
let state: SyncState = { pending: 0, busy: false, error: null, configured: false };
const subs = new Set<() => void>();
function set(patch: Partial<SyncState>) { state = { ...state, ...patch }; subs.forEach((f) => f()); }
export const useSync = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

const isConfigured = (s: Settings) => Boolean(s.owner.trim() && s.repo.trim() && s.token.trim());

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h);
}

class SyncError extends Error {}

// Il token viaggia solo nell'header Authorization. Non finisce mai in messaggi, log o URL.
async function api(s: Settings, path: string, init?: RequestInit): Promise<Response> {
  const url = `https://api.github.com/repos/${encodeURIComponent(s.owner.trim())}/${encodeURIComponent(s.repo.trim())}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${s.token.trim()}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch {
    throw new SyncError('Sei offline: i salvataggi restano in coda.');
  }
  if (res.status === 401) throw new SyncError('GitHub rifiuta il token: controllalo nelle impostazioni.');
  if (res.status === 403) throw new SyncError('Il token non ha il permesso Contents in scrittura su questo repo.');
  return res;
}

async function putFile(s: Settings, path: string, content: string, message: string) {
  const head = await api(s, path);
  let sha: string | undefined;
  if (head.ok) sha = ((await head.json()) as { sha?: string }).sha;
  else if (head.status !== 404) throw new SyncError(`GitHub ha risposto ${head.status} leggendo ${path}.`);
  const res = await api(s, path, { method: 'PUT', body: JSON.stringify({ message, content: b64(content), sha }) });
  if (res.status === 404) throw new SyncError('Repo non trovato: controlla utente e nome del repo, e che il token lo copra.');
  if (!res.ok) throw new SyncError(`GitHub ha risposto ${res.status} salvando ${path}.`);
}

export async function refreshSync() {
  const [q, s] = await Promise.all([db.queue(), db.settings()]);
  set({ pending: q.length, configured: isConfigured(s) });
}

/** Svuota la coda. Si può chiamare quante volte si vuole: senza rete o senza token non fa nulla. */
export async function flush(): Promise<void> {
  if (state.busy) return;
  const s = await db.settings();
  await refreshSync();
  if (!isConfigured(s) || !navigator.onLine) return;
  set({ busy: true, error: null });
  try {
    // README e programma attivo: riscritti solo quando cambiano con una nuova versione dell'app.
    const pushed = await db.pushed();
    for (const [path, content, message] of [['README.md', readme, 'Schema dei dati'], ['program.json', programJson, 'Programma attivo']] as const) {
      const key = `${s.owner}/${s.repo}/${path}`;
      if (pushed[key] === hash(content)) continue;
      await putFile(s, path, content, message);
      pushed[key] = hash(content);
      await db.savePushed(pushed);
    }
    for (const item of await db.queue()) {
      await putFile(s, item.path, item.content, item.message);
      await db.dequeue(item.path);
      if (item.sessionId) await db.markSynced(item.sessionId);
      await refreshSync();
    }
  } catch (e) {
    set({ error: e instanceof SyncError ? e.message : 'Sync non riuscita. Riprovo al prossimo salvataggio.' });
  } finally {
    set({ busy: false });
    await refreshSync();
  }
}

/** Prova il token leggendo la radice del repo, senza scrivere nulla. */
export async function testConnection(s: Settings): Promise<string> {
  if (!isConfigured(s)) return 'Compila utente, repo e token.';
  try {
    const res = await api(s, '');
    if (res.ok || res.status === 404) return res.ok ? 'Collegato: il repo risponde.' : 'Repo vuoto o non trovato: se è appena creato va bene, altrimenti controlla il nome.';
    return `GitHub ha risposto ${res.status}.`;
  } catch (e) {
    return e instanceof Error ? e.message : 'Connessione non riuscita.';
  }
}
