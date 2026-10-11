import { lastSession, nextProgram, program, shortDay } from './program';
import { readyToProgress } from './progression';
import type { Location, Part, ProgramId, StoredSession } from './types';
import { Icon, ReadyBadge, TopBar } from './ui';
import { go } from './nav';

const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const range = `${fmt.format(new Date(program.start + 'T00:00:00'))} – ${fmt.format(new Date(program.end + 'T00:00:00'))}`.replace(/\./g, '');

export function ProgramScreen({ sessions, onStart }: { sessions: StoredSession[]; onStart: (p: ProgramId, part: Part, loc: Location) => void }) {
  const next = { forza: nextProgram(sessions, 'forza'), emom: nextProgram(sessions, 'emom') };
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
                <small>{part === 'forza' ? `Palestra · circa ${p.forza.minutes}'` : "Casa · circa 25'"}</small>
                <span className={`st ${isNext ? 'go' : last ? 'done' : ''}`}>{isNext ? 'Tocca a questa' : last ? `Fatta ${shortDay(last.date).toLowerCase()}` : 'Mai fatta'}</span>
              </span>
            </button>
          );
        };
        return (
          <article className="daycard" key={p.id}>
            <div className="day-h"><b>{p.id}</b><h2 className="t-title">{p.name}</h2></div>
            <div className="parts">{tile('forza')}{tile('emom')}</div>
            {ready.map((n) => <ReadyBadge key={n} text={`${n}: pronto a salire`} />)}
          </article>
        );
      })}
    </div>
  );
}
