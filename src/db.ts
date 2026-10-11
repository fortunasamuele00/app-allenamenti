import { openDB, type DBSchema } from 'idb';
import type { Session, Settings, StoredSession } from './types';

export interface QueueItem { path: string; content: string; message: string; sessionId?: string }

interface Schema extends DBSchema {
  sessions: { key: string; value: StoredSession };
  queue: { key: string; value: QueueItem };
  kv: { key: string; value: unknown };
}

const dbp = openDB<Schema>('allenamenti', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    db.createObjectStore('queue', { keyPath: 'path' });
    db.createObjectStore('kv');
  },
});

export const defaultSettings: Settings = { owner: '', repo: 'allenamenti-data', token: '', restForza: 120, restWarmup: 30, restByExercise: {} };

export const db = {
  async sessions() { return (await dbp).getAll('sessions'); },
  async putSession(s: StoredSession) { await (await dbp).put('sessions', s); },
  async markSynced(id: string) {
    const d = await dbp; const s = await d.get('sessions', id);
    if (s) await d.put('sessions', { ...s, synced: true });
  },
  async queue() { return (await dbp).getAll('queue'); },
  async enqueue(item: QueueItem) { await (await dbp).put('queue', item); },
  async dequeue(path: string) { await (await dbp).delete('queue', path); },
  async settings(): Promise<Settings> { return { ...defaultSettings, ...((await (await dbp).get('kv', 'settings')) as Partial<Settings> | undefined) }; },
  async saveSettings(s: Settings) { await (await dbp).put('kv', s, 'settings'); },
  async draft() { return ((await (await dbp).get('kv', 'draft')) as Session | undefined) ?? null; },
  async saveDraft(s: Session | null) { const d = await dbp; if (s) await d.put('kv', s, 'draft'); else await d.delete('kv', 'draft'); },
  async pushed() { return ((await (await dbp).get('kv', 'pushed')) as Record<string, string> | undefined) ?? {}; },
  async savePushed(p: Record<string, string>) { await (await dbp).put('kv', p, 'pushed'); },
};
