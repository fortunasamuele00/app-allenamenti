import { blockWeek, getProgram, localDate, nextProgram, partLabel, program } from './program';
import { useSync } from './sync';
import type { Location, Part, ProgramId, Session, StoredSession } from './types';
import { DangerButton, Icon } from './ui';

const fmtToday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SyncChip() {
  const s = useSync();
  const text = !s.configured ? 'Sync da configurare' : s.busy ? 'Sincronizzo' : s.pending ? `${s.pending} in coda` : 'Salvato';
  const tone = !s.configured ? 'off' : s.pending ? 'wait' : 'ok';
  return <a className={`sync ${tone}`} href="#/impostazioni">{text}</a>;
}

export function Home({ sessions, draft, onStart, onDiscard, toast }: {
  sessions: StoredSession[]; draft: Session | null; toast: string | null; onDiscard: () => void;
  onStart: (p: ProgramId, part: Part, loc: Location) => void;
}) {
  const today = new Date();
  const wk = blockWeek(localDate(today));
  const gym = getProgram(nextProgram(sessions, 'forza'));
  const home = getProgram(nextProgram(sessions, 'emom'));
  const done = sessions.filter((s) => s.date >= wk.from && s.date <= wk.to).length;
  const goal = program.weekly.palestra + program.weekly.casa;
  const head = wk.state === 'before' ? `${program.name} · inizia l'${fmtShort.format(new Date(program.start + 'T00:00:00')).replace('.', '')}`
    : wk.state === 'after' ? `${program.name} · blocco concluso` : `${program.name} · settimana ${wk.week} di ${wk.weeks}`;

  return (
    <div className="screen with-nav">
      <div className="top"><p className="t-label">{head}</p><SyncChip /></div>
      <h1 className="t-display day">{cap(fmtToday.format(today))}<br />{fmtDate.format(today)}</h1>
      {toast && <p className="toast" role="status">{toast}</p>}

      {draft && (
        <div className="resume">
          <span><b>Seduta aperta</b><small>{draft.program} · {partLabel(draft.part)}</small></span>
          <a className="btn ink" href="#/seduta">Riprendi</a>
          <DangerButton label="Scarta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />
        </div>
      )}

      <article className="go">
        <p className="go-k"><Icon name="gym" />In palestra tocca a</p>
        <h2><b>{gym.id}</b>{gym.name}</h2>
        <p className="go-m">Parte 1 · warm-up + forza · circa {gym.forza.minutes}'</p>
        <p className="go-l">{gym.forza.exercises.map((e) => `${e.palestra.name} ${e.sets} × ${e.palestra.target}`).join(' · ')}</p>
        <button className="btn pri" type="button" onClick={() => onStart(gym.id, 'forza', 'palestra')}>Inizia in palestra</button>
      </article>

      <article className="go casa">
        <p className="go-k"><Icon name="home" />A casa tocca a</p>
        <h2><b>{home.id}</b>{home.name}</h2>
        <p className="go-m">Parte 2 · EMOM {home.emom.minutes}' + stretching · circa 25'</p>
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

      <a className="all" href="#/programma">Tutto il programma<Icon name="chev" /></a>
    </div>
  );
}
