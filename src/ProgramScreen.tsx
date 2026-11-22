import { useState } from 'react';
import { F20, lastSession, nextProgram, program, shortDay, sortedDesc } from './program';
import { readyToProgress } from './progression';
import type { Location, Part, ProgramId, Settings, StoredSession } from './types';
import { feelOf, GuideSheet, Icon, Muscles, muscleSummary, NameButton, ReadyBadge, TopBar, type GuideRef } from './ui';
import { go } from './nav';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const range = `${fmt.format(new Date(program.start + 'T00:00:00'))} – ${fmt.format(new Date(program.end + 'T00:00:00'))}`.replace(/\./g, '');

export function ProgramScreen({ sessions, settings, onStart }: { sessions: StoredSession[]; settings: Settings; onStart: (p: ProgramId, part: Part, loc: Location) => void }) {
  const next = { forza: nextProgram(sessions, 'forza'), emom: nextProgram(sessions, 'emom') };
  const [open, setOpen] = useState<ProgramId | null>(null);
  const [guide, setGuide] = useState<GuideRef | null>(null);
  // L'anteprima mostra la forza dove la fai di solito, come la home.
  const loc: Location = (() => {
    try { const v = localStorage.getItem('dove-forza'); if (v === 'palestra' || v === 'casa') return v; } catch { /* nessuna preferenza */ }
    return sortedDesc(sessions).find((x) => x.part === 'forza')?.location ?? 'palestra';
  })();
  const row = (g: GuideRef, target: string) => (
    <div className="pv-row" key={g.key}>
      <NameButton guide={g} onOpen={setGuide} /><small>{target}</small>
      {feelOf(g.key) && <Muscles list={feelOf(g.key).muscles} />}
    </div>
  );
  return (
    <div className="screen with-nav">
      <TopBar title="Programma" onBack={() => { go('#/'); }} />
      <div className="prog-h"><p className="t-label">{range}</p><h1 className="t-display">{program.name}</h1></div>
      {program.programs.map((p) => {
        const ready = [
          ...p.forza.exercises.flatMap((e) => (['palestra', 'casa'] as const).filter((v) => readyToProgress(sessions, p.id, 'forza', e.id, v)).map((v) => e[v].name)),
          ...p.emom.exercises.filter((e) => readyToProgress(sessions, p.id, 'emom', e.id, 'casa')).map((e) => e.name),
        ];
        const tile = (part: Part) => {
          const last = lastSession(sessions, p.id, part);
          const isNext = next[part] === p.id;
          return (
            <button className={`part${part === 'emom' ? ' casa' : ''}${isNext ? ' next' : ''}`} type="button" onClick={() => onStart(p.id, part, part === 'emom' ? 'casa' : 'palestra')}>
              <span>Parte {part === 'forza' ? 1 : 2}<Icon name={part === 'forza' ? 'gym' : 'home'} /></span>
              <span>
                <b>{part === 'forza' ? 'Warm-up + forza' : `EMOM ${p.emom.minutes}' + stretching`}</b>
                <small>{part === 'forza' ? (settings.forza20 ? `In circuito · ${F20.minutes}'` : `Palestra · circa ${p.forza.minutes}'`) : "Casa · circa 25'"}</small>
                <span className={`st ${isNext ? 'go' : last ? 'done' : ''}`}>{isNext ? 'Tocca a questa' : last ? `Fatta ${shortDay(last.date).toLowerCase()}` : 'Mai fatta'}</span>
              </span>
            </button>
          );
        };
        return (
          <article className="daycard" key={p.id}>
            <div className="day-h"><b>{p.id}</b><h2 className="t-title">{p.name}</h2></div>
            <p className="go-mu">{muscleSummary(p.forza.exercises.map((e) => `${e.id}:${loc}`).concat(p.emom.exercises.map((e) => e.id))).slice(0, 6).join(' · ')}</p>
            <div className="parts">{tile('forza')}{tile('emom')}</div>
            <button className="pv-toggle" type="button" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
              {open === p.id ? 'Nascondi esercizi' : 'Vedi esercizi e muscoli'}<Icon name="chev" />
            </button>
            {open === p.id && (
              <div className="pv">
                <h4>Warm-up</h4>
                {p.forza.warmup.exercises.map((e) => row({ key: e.id, name: e.name }, e.target))}
                <h4>Forza · {loc === 'casa' ? 'a casa' : 'in palestra'}</h4>
                {p.forza.exercises.map((e) => row({ key: `${e.id}:${loc}`, name: e[loc].name, note: e[loc].note }, `${settings.forza20 ? Math.min(e.sets, F20.rounds) : e.sets} × ${e[loc].target}`))}
                <h4>EMOM a casa</h4>
                {p.emom.exercises.map((e) => row({ key: e.id, name: e.name, note: e.note, coach: e.coach }, e.target))}
              </div>
            )}
            {ready.map((n) => <ReadyBadge key={n} text={`${n}: pronto a salire`} />)}
          </article>
        );
      })}
      {guide && <GuideSheet guide={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
