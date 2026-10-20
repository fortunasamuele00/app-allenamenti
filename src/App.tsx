import { useCallback, useEffect, useState } from 'react';
import { db, defaultSettings } from './db';
import { EmomScreen } from './EmomScreen';
import { History, SessionDetail } from './History';
import { Home } from './Home';
import { healthUrl, newSession, sessionId } from './program';
import { ProgramScreen } from './ProgramScreen';
import { SessionScreen } from './SessionScreen';
import { SettingsScreen } from './SettingsScreen';
import { flush, refreshSync, useSync } from './sync';
import type { Location, Part, ProgramId, Session, Settings, StoredSession } from './types';
import { Icon, Sheet, type IconName } from './ui';
import { go, Link, useRoute } from './nav';

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '#/', label: 'Programma', icon: 'rows' },
  { href: '#/storico', label: 'Storico', icon: 'chart' },
  { href: '#/impostazioni', label: 'Impostazioni', icon: 'sliders' },
];

export function App() {
  const hash = useRoute();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [draft, setDraftState] = useState<Session | null>(null);
  const [toast, setToast] = useState<{ text: string; health?: string } | null>(null);
  const [pendingStart, setPendingStart] = useState<[ProgramId, Part, Location] | null>(null);

  const reload = useCallback(async () => setSessions(await db.sessions()), []);
  // Quando la coda si svuota, le sedute risultano salvate anche nello storico.
  const { pending } = useSync();
  useEffect(() => { void reload(); }, [pending, reload]);
  useEffect(() => {
    void (async () => {
      // Se i dati salvati non si leggono, l'app parte lo stesso e lo dice, invece di restare vuota.
      try {
        const [s, st, d] = await Promise.all([db.sessions(), db.settings(), db.draft()]);
        setSessions(s); setSettings(st); setDraftState(d);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
      setReady(true);
      await refreshSync();
      void flush().then(reload);
    })();
    const online = () => void flush().then(reload);
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [reload]);

  const setDraft = (d: Session | null) => { setDraftState(d); void db.saveDraft(d); };
  const saveSettings = async (s: Settings) => { setSettings(s); await db.saveSettings(s); await refreshSync(); };

  const begin = (p: ProgramId, part: Part, loc: Location) => {
    setPendingStart(null);
    setToast(null);
    setDraft(newSession(p, part, loc, sessions, settings));
    go('#/seduta');
  };
  const start = (p: ProgramId, part: Part, loc: Location) => (draft ? setPendingStart([p, part, loc]) : begin(p, part, loc));

  // Salvataggio: prima sul telefono e in coda, poi si prova GitHub. Offline resta in coda.
  const finish = async (s: Session) => {
    const done: Session = {
      ...s, endedAt: new Date().toISOString(),
      exercises: s.exercises
        .filter((e) => e.block !== 'cardio' || e.sets[0].minutes != null)
        .map((e) => (e.block === 'cardio' ? { ...e, sets: e.sets.map((x) => ({ ...x, done: true })) } : e)),
    };
    const id = sessionId(done);
    await db.putSession({ ...done, id, synced: false });
    await db.enqueue({ path: `sessions/${id}.json`, content: JSON.stringify(done, null, 2) + '\n', message: `Seduta ${id}`, sessionId: id });
    setDraft(null);
    await reload();
    // Con Salute attiva il messaggio resta finché non lo usi: porta il pulsante che apre il Comando rapido.
    if (settings.health) setToast({ text: 'Seduta salvata.', health: healthUrl(done) });
    else { setToast({ text: 'Seduta salvata.' }); setTimeout(() => setToast(null), 5000); }
    go('#/');
    void flush().then(reload);
  };
  const discard = () => { setDraft(null); go('#/'); };

  if (!ready) return null;

  let view;
  let nav = true;
  if (hash === '#/seduta' && draft) {
    nav = false;
    view = draft.part === 'forza'
      ? <SessionScreen draft={draft} setDraft={setDraft} sessions={sessions} settings={settings} saveSettings={(s) => void saveSettings(s)} onFinish={(s) => void finish(s)} onDiscard={discard} />
      : <EmomScreen draft={draft} setDraft={setDraft} sessions={sessions} onFinish={(s) => void finish(s)} onDiscard={discard} />;
  } else if (hash === '#/programma') view = <ProgramScreen sessions={sessions} onStart={start} />;
  else if (hash.startsWith('#/storico/')) {
    const s = sessions.find((x) => x.id === decodeURIComponent(hash.slice('#/storico/'.length)));
    nav = false;
    view = s ? <SessionDetail session={s} sessions={sessions} health={settings.health} /> : <History sessions={sessions} />;
  } else if (hash === '#/storico') view = <History sessions={sessions} />;
  else if (hash === '#/impostazioni') view = <SettingsScreen settings={settings} saveSettings={saveSettings} />;
  else view = <Home sessions={sessions} draft={draft} onStart={start} onDiscard={() => setDraft(null)} toast={toast} onToastUsed={() => setToast(null)} />;

  const current = hash === '#/programma' ? '#/' : hash;
  return (
    <div className="app">
      {bootError && <p className="boot-err" role="alert">Non riesco a leggere i dati salvati su questo telefono ({bootError}). Chiudi l'app e riaprila; se succede ancora, dimmelo.</p>}
      {view}
      {pendingStart && (
        <Sheet title="Hai una seduta aperta" onClose={() => setPendingStart(null)}>
          <p className="note">Se ne inizi un'altra, quella aperta viene scartata senza essere salvata.</p>
          <button className="btn ink wide" type="button" onClick={() => { go('#/seduta'); setPendingStart(null); }}>Riprendi quella aperta</button>
          <button className="btn wide" type="button" onClick={() => begin(...pendingStart)}>Scartala e inizia questa</button>
        </Sheet>
      )}
      {nav && (
        <nav className="foot" aria-label="Sezioni">
          <ul className="nav">
            {TABS.map((t) => (
              <li key={t.href}><Link to={t.href} aria-current={current === t.href ? 'page' : undefined}><Icon name={t.icon} />{t.label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
