import { useState } from 'react';
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

const fmtMonth = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

/** Il mese a griglia, da lunedì: i giorni in cui ti sei allenato sono arancioni, con la lettera della seduta. */
function MonthCalendar({ sessions }: { sessions: StoredSession[] }) {
  const [shift, setShift] = useState(0);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + shift, 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const today = localDate(now);
  const byDay = new Map<string, StoredSession[]>();
  for (const s of sessions) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const cells = Array.from({ length: lead + days }, (_, i) => (i < lead ? null : localDate(new Date(first.getFullYear(), first.getMonth(), i - lead + 1))));
  const trained = cells.filter((d) => d && byDay.has(d)).length;
  const label = fmtMonth.format(first);
  return (
    <section className="ex cal">
      <div className="cal-h">
        <button type="button" aria-label="Mese prima" onClick={() => setShift(shift - 1)}><Icon name="back" /></button>
        <h2 className="t-title">{label.charAt(0).toUpperCase() + label.slice(1)}</h2>
        <button type="button" aria-label="Mese dopo" disabled={shift >= 0} onClick={() => setShift(shift + 1)}><Icon name="chev" /></button>
      </div>
      <div className="cal-g" role="grid">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <span key={i} className="cal-wd">{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const list = byDay.get(d);
          const cls = [list ? 'on' : '', d === today ? 'today' : '', d > today ? 'fut' : ''].join(' ');
          return (
            <span key={i} className={`cal-d ${cls}`} aria-label={`${Number(d.slice(8))}${list ? ': ' + list.map((x) => `${x.part === 'forza' ? 'forza' : 'EMOM'} ${x.program}`).join(', ') : ''}`}>
              <b>{Number(d.slice(8))}</b>{list && <small>{list.map((x) => x.program).join('')}</small>}
            </span>
          );
        })}
      </div>
      <p className="t-label">{trained} {trained === 1 ? 'giorno' : 'giorni'} di allenamento</p>
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
      <MonthCalendar sessions={sessions} />

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
