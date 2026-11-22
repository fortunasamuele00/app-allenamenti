import { useState } from 'react';
import { blockWeek, F20, getProgram, localDate, partLabel, program, SEQ, sequenceState, sortedDesc, stepLabel } from './program';
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

/** La sequenza fissa: fatte, quella che tocca, e il riposo in fondo. */
export function SeqStrip({ index, done, rest = false }: { index: number; done: number; rest?: boolean }) {
  return (
    <section className="seq" aria-label="Sequenza">
      <ol>
        {SEQ.map((x, i) => (
          <li key={i} className={rest || i < done ? 'd' : i === index ? 'now' : ''}><small>{x.part === 'forza' ? 'Forza' : 'EMOM'}</small><b>{x.program}</b></li>
        ))}
        <li className={`rest${rest ? ' now' : ''}`}><small>Riposo</small><b>–</b></li>
      </ol>
      <p>{rest ? 'Poi si riparte da Forza A' : <>Poi: {index === SEQ.length - 1 ? 'riposo, e si riparte da Forza A' : `${stepLabel(SEQ[index + 1])} · ${getProgram(SEQ[index + 1].program).name}`}</>}</p>
    </section>
  );
}

export function Home({ sessions, settings, draft, onStart, onDiscard, toast }: {
  sessions: StoredSession[]; settings: Settings; draft: Session | null; toast: string | null; onDiscard: () => void;
  onStart: (p: ProgramId, part: Part, loc: Location) => void;
}) {
  const today = new Date();
  const wk = blockWeek(localDate(today));
  const seq = sequenceState(sessions);
  const step = SEQ[seq.index];
  const cur = getProgram(step.program);
  // Dopo l'ultima della sequenza c'è un giorno di riposo: lo dice, ma non blocca.
  const yesterday = localDate(new Date(today.getTime() - 86400000));
  const closed = seq.index === 0 && seq.last;
  const rest = closed && seq.last!.date === localDate(today) ? 'Giro chiuso: domani riposo, poi'
    : closed && seq.last!.date === yesterday ? 'Oggi riposo, poi' : null;
  // Dove fai la forza si sceglie qui, prima di entrare: parte da dove l'hai fatta l'ultima volta.
  const [loc, setLocState] = useState<Location>(() => {
    try { const v = localStorage.getItem('dove-forza'); if (v === 'palestra' || v === 'casa') return v; } catch { /* nessuna preferenza */ }
    return sortedDesc(sessions).find((s) => s.part === 'forza')?.location ?? 'palestra';
  });
  const setLoc = (l: Location) => { setLocState(l); try { localStorage.setItem('dove-forza', l); } catch { /* resta per questa apertura */ } };
  const where: Location = step.part === 'emom' ? 'casa' : loc;
  const done = sessions.filter((s) => s.date >= wk.from && s.date <= wk.to).length;
  const goal = program.weekly.palestra + program.weekly.casa;
  const head = wk.state === 'before' ? `${program.name} · inizia ${/^(1|8|11) /.test(fmtShort.format(new Date(program.start + 'T00:00:00'))) ? "l'" : 'il '}${fmtShort.format(new Date(program.start + 'T00:00:00')).replace('.', '')}`
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

      <article className={`go${step.part === 'emom' || loc === 'casa' ? ' casa' : ''}`}>
        <div className="go-top">
          <p className="go-k">{rest ?? `Tocca a · ${seq.index + 1} di ${SEQ.length}`}</p>
          {step.part === 'forza' ? (
            <div className="where" role="group" aria-label="Dove fai la forza">
              {(['palestra', 'casa'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={loc === l} aria-label={l === 'palestra' ? 'In palestra' : 'A casa'} onClick={() => setLoc(l)}><Icon name={l === 'palestra' ? 'gym' : 'home'} /></button>
              ))}
            </div>
          ) : <span className="where-fixed" aria-label="A casa"><Icon name="home" /></span>}
        </div>
        <h2><b>{cur.id}</b>{step.part === 'forza' ? 'Forza' : 'EMOM'} · {cur.name}</h2>
        <p className="go-m">{step.part === 'forza'
          ? (settings.forza20 ? `Warm-up + forza in circuito · ${F20.minutes}'` : `Warm-up + forza · circa ${cur.forza.minutes}'`)
          : `EMOM ${cur.emom.minutes}' + stretching · circa 25'`}</p>
        <p className="go-mu">{muscleSummary(step.part === 'forza' ? cur.forza.exercises.map((e) => `${e.id}:${loc}`) : cur.emom.exercises.map((e) => e.id)).join(' · ')}</p>
        <p className="go-l">{step.part === 'forza'
          ? cur.forza.exercises.map((e) => `${e[loc].name} ${settings.forza20 ? Math.min(e.sets, F20.rounds) : e.sets} × ${e[loc].target}`).join(' · ')
          : cur.emom.exercises.map((e) => e.name).join(' · ')}</p>
        <button className={`btn ${step.part === 'forza' ? 'pri' : 'ink'}`} type="button" onClick={() => onStart(cur.id, step.part, where)}>{where === 'casa' ? 'Inizia a casa' : 'Inizia in palestra'}</button>
      </article>

      <SeqStrip index={seq.index} done={seq.done} rest={!!rest} />

      <section className="week">
        <div className="week-h"><h2 className="t-head">Questa settimana</h2><span>{Math.min(done, goal)} di {goal}</span></div>
        <div className="caps" role="img" aria-label={`${done} sedute fatte su ${goal}`}>
          {Array.from({ length: goal }, (_, i) => <i key={i} className={i < done ? 'd' : ''} />)}
        </div>
      </section>

      <Link className="all" to="#/programma">Tutto il programma<Icon name="chev" /></Link>
    </div>
  );
}
