import muscleData from './muscles.json';
import { describeSet, getProgram, localDate, minutesOf, partLabel, shortDay, sortedDesc } from './program';
import { progressTip } from './progression';
import type { StoredSession } from './types';
import { ThemeToggle } from './theme';
import { Icon, TipCard, TopBar } from './ui';
import { go, Link } from './nav';

const GROUPS = muscleData.groups;
const MUSCLES = muscleData.byExercise as Record<string, string[]>;

/** Serie fatte per gruppo muscolare tra due date comprese. Warm-up e cardio non contano. */
function setsByGroup(sessions: StoredSession[], from: string, to: string): number[] {
  const tot = GROUPS.map(() => 0);
  for (const s of sessions) {
    if (s.date < from || s.date > to) continue;
    for (const e of s.exercises) {
      if (e.block === 'warmup' || e.block === 'cardio') continue;
      const done = e.sets.filter((x) => x.done).length;
      for (const g of MUSCLES[e.id] ?? []) tot[GROUPS.indexOf(g)] += done;
    }
  }
  return tot;
}

function MuscleRadar({ sessions }: { sessions: StoredSession[] }) {
  // Settimane da lunedì a domenica: questa (fino a oggi) e quella prima.
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const day = (offset: number) => localDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset));
  const now = setsByGroup(sessions, day(0), day(6)), prev = setsByGroup(sessions, day(-7), day(-1));
  const since = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric' }).format(monday).replace(/\./g, '');
  const W = 326, H = 250, cx = W / 2, cy = 124, R = 84, n = GROUPS.length;
  const max = Math.max(1, ...now, ...prev);
  const pt = (i: number, r: number) => { const a = (-90 + (360 / n) * i) * (Math.PI / 180); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, (v / max) * R).join(',')).join(' ');
  return (
    <section className="ex">
      <div className="ex-h"><h2 className="t-title">Gruppi muscolari</h2><span>serie fatte</span></div>
      <svg className="radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Serie di questa settimana, da ${since}: ${GROUPS.map((g, i) => `${g} ${now[i]}`).join(', ')}`}>
        {[1 / 3, 2 / 3, 1].map((k) => <polygon key={k} className="ring" points={GROUPS.map((_, i) => pt(i, R * k).join(',')).join(' ')} />)}
        {GROUPS.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} className="ring" x1={cx} y1={cy} x2={x} y2={y} />; })}
        <polygon className="prev" points={poly(prev)} />
        <polygon className="cur" points={poly(now)} />
        {GROUPS.map((g, i) => {
          const [x, y] = pt(i, R + 14);
          const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
          return <text key={g} x={x} y={y + (y < cy - R ? -8 : y > cy + R ? 12 : 0)} textAnchor={anchor} className="lab">{g}<tspan className="val"> {now[i]}</tspan></text>;
        })}
      </svg>
      <p className="key t-label"><span><i />Questa settimana, da {since}</span><span><i className="p" />Settimana scorsa</span></p>
      <p className="t-label">Conta le serie spuntate di forza ed EMOM. L'attribuzione ai gruppi è indicativa, non del coach.</p>
    </section>
  );
}

export function History({ sessions }: { sessions: StoredSession[] }) {
  const list = sortedDesc(sessions);
  return (
    <div className="screen with-nav">
      <div className="top"><p className="t-label">{list.length} {list.length === 1 ? 'seduta' : 'sedute'}</p><ThemeToggle /></div>
      <h1 className="t-display day">Storico</h1>

      {!list.length && <p className="empty">Qui trovi le sedute salvate e i muscoli lavorati nella settimana. Inizia la prima dalla scheda Programma.</p>}

      {list.length > 0 && <MuscleRadar sessions={sessions} />}

      {list.length > 0 && <h2 className="t-head log-h">Sedute</h2>}
      <div className="log">
        {list.map((s) => (
          <Link key={s.id} to={`#/storico/${s.id}`}>
            <i className={s.part === 'emom' ? 'h' : ''}>{s.program}</i>
            <span><b>{partLabel(s.part)}</b><small>{shortDay(s.date)} · {s.location}{minutesOf(s) ? ` · ${minutesOf(s)} min` : ''}{s.synced ? '' : ' · in coda'}</small></span>
            <Icon name="chev" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SessionDetail({ session, sessions }: { session: StoredSession; sessions: StoredSession[] }) {
  const def = getProgram(session.program);
  return (
    <div className="screen">
      <TopBar title={shortDay(session.date)} onBack={() => { go('#/storico'); }} />
      <h1 className="t-display day">{def.id} · {def.name}</h1>
      <p className="t-label">{partLabel(session.part)} · {session.location}{minutesOf(session) ? ` · ${minutesOf(session)} min` : ''} · {session.synced ? 'salvata su GitHub' : 'in coda per GitHub'}</p>
      {session.exercises.map((ex) => {
        const done = ex.sets.filter((s) => s.done);
        return (
          <article className="ex detail" key={ex.id}>
            <div className="ex-h"><h2 className="t-head">{ex.name}</h2><span>{ex.target}</span></div>
            <p>{done.length ? done.map((s) => describeSet(ex, s)).join(' · ') : 'Nessuna serie spuntata'}</p>
            <TipCard tip={progressTip(sessions, session.program, session.part, ex.id, ex.variant)} />
          </article>
        );
      })}
      {session.notes && <p className="note">{session.notes}</p>}
    </div>
  );
}
