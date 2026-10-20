import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Session, Settings, StoredSession } from './types';

export interface QueueItem { path: string; content: string; message: string; sessionId?: string }

interface Schema extends DBSchema {
  sessions: { key: string; value: StoredSession };
  queue: { key: string; value: QueueItem };
  kv: { key: string; value: unknown };
}

// Su iPhone la connessione a IndexedDB può cadere quando l'app resta a lungo in background
// ("Connection to Indexed Database server lost"). Se succede la si riapre, invece di restare bloccati.
let conn: Promise<IDBPDatabase<Schema>> | null = null;
function open(): Promise<IDBPDatabase<Schema>> {
  conn ??= Promise.race([
    openDB<Schema>('allenamenti', 1, {
      upgrade(db) {
        db.createObjectStore('sessions', { keyPath: 'id' });
        db.createObjectStore('queue', { keyPath: 'path' });
        db.createObjectStore('kv');
      },
      blocking() { conn = null; },
      terminated() { conn = null; },
    }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('IndexedDB non risponde')), 5000)),
  ]).catch((e) => { conn = null; throw e; });
  return conn;
}
async function use<T>(fn: (d: IDBPDatabase<Schema>) => Promise<T>): Promise<T> {
  try { return await fn(await open()); } catch { conn = null; return fn(await open()); }
}

export const defaultSettings: Settings = { owner: '', repo: 'allenamenti-data', token: '', restForza: 120, restWarmup: 30, restByExercise: {}, health: false };

export const db = {
  sessions: () => use((d) => d.getAll('sessions')),
  putSession: (s: StoredSession) => use(async (d) => { await d.put('sessions', s); }),
  markSynced: (id: string) => use(async (d) => {
    const s = await d.get('sessions', id);
    if (s) await d.put('sessions', { ...s, synced: true });
  }),
  queue: () => use((d) => d.getAll('queue')),
  enqueue: (item: QueueItem) => use(async (d) => { await d.put('queue', item); }),
  dequeue: (path: string) => use((d) => d.delete('queue', path)),
  settings: (): Promise<Settings> => use(async (d) => ({ ...defaultSettings, ...((await d.get('kv', 'settings')) as Partial<Settings> | undefined) })),
  saveSettings: (s: Settings) => use(async (d) => { await d.put('kv', s, 'settings'); }),
  draft: () => use(async (d) => ((await d.get('kv', 'draft')) as Session | undefined) ?? null),
  saveDraft: (s: Session | null) => use(async (d) => { if (s) await d.put('kv', s, 'draft'); else await d.delete('kv', 'draft'); }),
  pushed: () => use(async (d) => ((await d.get('kv', 'pushed')) as Record<string, string> | undefined) ?? {}),
  savePushed: (p: Record<string, string>) => use(async (d) => { await d.put('kv', p, 'pushed'); }),
};
