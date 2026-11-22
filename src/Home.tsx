import { useState } from 'react';
import { blockWeek, F20, getProgram, localDate, nextProgram, partLabel, program, sortedDesc } from './program';
import { useSync } from './sync';
import type { Location, Part, ProgramId, Session, Settings, StoredSession } from './types';
import { ThemeToggle } from './theme';
import { DangerButton, Icon, muscleSummary } from './ui';
import { Link } from './nav';

const fmtToday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SyncChip() {
  const s = useSync();
  const text = !s.configured ? 'Sync da configurare' : s.busy ? 'Sincronizzo' : s.pending ? `${s.pending} in coda` : 'Salvato';
  const tone = !s.configured ? 'off' : s.pending ? 'wait' : 'ok';
  return <Link className={`sync ${tone}`} to="#/impostazioni">{text}</Link>;
}

export function Home({ sessions, settings, draft, onStart, onDiscard, toast }: {
  sessions: StoredSession[]; settings: Settings; draft: Session | null; toast: string | null; onDiscard: () => void;
  onStart: (p: ProgramId, part: Part, loc: Location) => void;
}) {
  const today = new Date();
  const wk = blockWeek(localDate(today));
  const gym = getProgram(nextProgram(sessions, 'forza'));
  // Dove fai la forza si sceglie qui, prima di entrare: parte da dove l'hai fatta l'ultima volta.
  const [loc, setLocState] = useState<Location>(() => {
    try { const v = localStorage.getItem('dove-forza'); if (v === 'palestra' || v === 'casa') return v; } catch { /* nessuna preferenza */ }
    return sortedDesc(sessions).find((s) => s.part === 'forza')?.location ?? 'palestra';
  });
  const setLoc = (l: Location) => { setLocState(l); try { localStorage.setItem('dove-forza', l); } catch { /* resta per questa apertura */ } };
  const home = getProgram(nextProgram(sessions, 'emom'));
  const done = sessions.filter((s) => s.date >= wk.from && s.date <= wk.to).length;
  const goal = program.weekly.palestra + program.weekly.casa;
  const head = wk.state === 'before' ? `${program.name} · inizia l'${fmtShort.format(new Date(program.start + 'T00:00:00')).replace('.', '')}`
    : wk.state === 'after' ? `${program.name} · blocco concluso` : `${program.name} · settimana ${wk.week} di ${wk.weeks}`;

  return (
    <div className="screen with-nav">
      <div className="top"><p className="t-label">{head}</p><span className="top-r"><SyncChip /><ThemeToggle /></span></div>
      <h1 className="t-display day">{cap(fmtToday.format(today))}<br />{fmtDate.format(today)}</h1>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
        </div>
      )}

      {draft && (
        <div className="resume">
          <span><b>Seduta aperta</b><small>{draft.program} · {partLabel(draft.part)}</small></span>
          <Link className="btn ink" to="#/seduta">Riprendi</Link>
          <DangerButton label="Scarta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />
        </div>
      )}

      <article className={`go${loc === 'casa' ? ' casa' : ''}`}>
        <div className="go-top">
          <p className="go-k">Forza · tocca a</p>
          <div className="where" role="group" aria-label="Dove fai la forza">
            {(['palestra', 'casa'] as const).map((l) => (
              <button key={l} type="button" aria-pressed={loc === l} aria-label={l === 'palestra' ? 'In palestra' : 'A casa'} onClick={() => setLoc(l)}><Icon name={l === 'palestra' ? 'gym' : 'home'} /></button>
            ))}
          </div>
        </div>
        <h2><b>{gym.id}</b>{gym.name}</h2>
        <p className="go-m">{settings.forza20 ? `Parte 1 · warm-up + forza in circuito · ${F20.minutes}'` : `Parte 1 · warm-up + forza · circa ${gym.forza.minutes}'`}</p>
        <p className="go-mu">{muscleSummary(gym.forza.exercises.map((e) => `${e.id}:${loc}`)).join(' · ')}</p>
        <p className="go-l">{gym.forza.exercises.map((e) => `${e[loc].name} ${settings.forza20 ? Math.min(e.sets, F20.rounds) : e.sets} × ${e[loc].target}`).join(' · ')}</p>
        <button className="btn pri" type="button" onClick={() => onStart(gym.id, 'forza', loc)}>{loc === 'casa' ? 'Inizia a casa' : 'Inizia in palestra'}</button>
      </article>

      <article className="go casa">
        <p className="go-k"><Icon name="home" />EMOM a casa · tocca a</p>
        <h2><b>{home.id}</b>{home.name}</h2>
        <p className="go-m">Parte 2 · EMOM {home.emom.minutes}' + stretching · circa 25'</p>
        <p className="go-mu">{muscleSummary(home.emom.exercises.map((e) => e.id)).join(' · ')}</p>
        <p className="go-l">{home.emom.exercises.map((e) => e.name).join(' · ')}</p>
        <button className="btn ink" type="button" onClick={() => onStart(home.id, 'emom', 'casa')}>Inizia a casa</button>
      </article>

      <section className="week">
        <div className="week-h"><h2 className="t-head">Questa settimana</h2><span>{Math.min(done, goal)} di {goal}</span></div>
        <div className="caps" role="img" aria-label={`${done} sedute fatte su ${goal}`}>
          {Array.from({ length: goal }, (_, i) => <i key={i} className={i < done ? 'd' : ''} />)}
        </div>
        <p className="t-label">{program.weekly.palestra} in palestra, {program.weekly.casa} a casa, {program.weekly.riposo} giorno di riposo</p>
      </section>

      <Link className="all" to="#/programma">Tutto il programma<Icon name="chev" /></Link>
    </div>
  );
}
