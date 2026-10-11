import { useMemo, useState } from 'react';
import muscleData from './muscles.json';
import { describeSet, getProgram, healthUrl, localDate, minutesOf, partLabel, shortDay, sortedDesc } from './program';
import { readyToProgress } from './progression';
import type { ExLog, StoredSession } from './types';
import { ThemeToggle } from './theme';
import { Icon, ReadyBadge, TopBar } from './ui';
import { go, Link } from './nav';

interface Point { date: string; value: number }

const METRICS: Record<ExLog['type'], { max: string; vol: string | null; unit: string; volUnit: string }> = {
  peso_rip: { max: 'Carico massimo', vol: 'Volume (kg × ripetizioni)', unit: 'kg', volUnit: 'kg' },
  elastico_rip: { max: 'Ripetizioni massime in una serie', vol: 'Ripetizioni totali', unit: 'rip', volUnit: 'rip' },
  corpo_rip: { max: 'Ripetizioni massime in una serie', vol: 'Ripetizioni totali', unit: 'rip', volUnit: 'rip' },
  tempo: { max: 'Tenuta più lunga', vol: 'Secondi totali', unit: '"', volUnit: '"' },
  cardio: { max: 'Minuti', vol: null, unit: "'", volUnit: "'" },
};

function measure(ex: ExLog): { max: number; vol: number } | null {
  const done = ex.sets.filter((s) => s.done);
  const vals = done.map((s) => (ex.type === 'peso_rip' ? s.kg : ex.type === 'tempo' ? s.seconds : ex.type === 'cardio' ? s.minutes : s.reps)).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const vol = ex.type === 'peso_rip' ? done.reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0) : vals.reduce((a, b) => a + b, 0);
  return { max: Math.max(...vals), vol };
}

function LineChart({ title, points, unit }: { title: string; points: Point[]; unit: string }) {
  const W = 326, H = 132, L = 8, R = 8, T = 22, B = 22;
  const vals = points.map((p) => p.value), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => (min === max ? (T + H - B) / 2 : T + (1 - (v - min) / span) * (H - T - B));
  const last = points[points.length - 1];
  const num = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
  return (
    <figure className="chart">
      <figcaption><span>{title}</span><b>{num(last.value)} {unit}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((p) => `${shortDay(p.date)} ${num(p.value)}`).join(', ')}`}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis" />
        {points.length > 1 && <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} className="ln" />}
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.5} className={i === points.length - 1 ? 'pt now' : 'pt'} />)}
        <text x={L} y={H - 6} className="tick">{shortDay(points[0].date)}</text>
        {points.length > 1 && <text x={W - R} y={H - 6} className="tick" textAnchor="end">{shortDay(last.date)}</text>}
        {points.length > 1 && min !== max && <text x={L} y={12} className="tick">da {num(min)} a {num(max)} {unit}</text>}
      </svg>
    </figure>
  );
}

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
  const day = (back: number) => localDate(new Date(Date.now() - back * 86400000));
  const now = setsByGroup(sessions, day(6), day(0)), prev = setsByGroup(sessions, day(13), day(7));
  const W = 326, H = 250, cx = W / 2, cy = 124, R = 84, n = GROUPS.length;
  const max = Math.max(1, ...now, ...prev);
  const pt = (i: number, r: number) => { const a = (-90 + (360 / n) * i) * (Math.PI / 180); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, (v / max) * R).join(',')).join(' ');
  return (
    <section className="ex">
      <div className="ex-h"><h2 className="t-title">Gruppi muscolari</h2><span>serie fatte</span></div>
      <svg className="radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Serie negli ultimi 7 giorni: ${GROUPS.map((g, i) => `${g} ${now[i]}`).join(', ')}`}>
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
      <p className="key t-label"><span><i />Ultimi 7 giorni</span><span><i className="p" />7 giorni prima</span></p>
      <p className="t-label">Conta le serie spuntate di forza ed EMOM. L'attribuzione ai gruppi è indicativa, non del coach.</p>
    </section>
  );
}

export function History({ sessions }: { sessions: StoredSession[] }) {
  const list = sortedDesc(sessions);
  const options = useMemo(() => {
    const m = new Map<string, { name: string; type: ExLog['type'] }>();
    for (const s of sessions) for (const e of s.exercises) {
      if (!measure(e)) continue;
      // Stesso nome in blocchi o varianti diverse (lo squat del warm-up e quello di forza): l'etichetta li distingue.
      const tag = e.block === 'warmup' ? ' (warm-up)' : e.block === 'forza' && e.variant === 'casa' ? ' (casa)' : '';
      m.set(`${e.id}|${e.variant}`, { name: e.name + tag, type: e.type });
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [sessions]);
  const [key, setKey] = useState('');
  const sel = options.find(([k]) => k === key) ?? options[0];

  const series = useMemo(() => {
    if (!sel) return null;
    const [id, variant] = sel[0].split('|');
    const max: Point[] = [], vol: Point[] = [];
    for (const s of [...list].reverse()) {
      const ex = s.exercises.find((e) => e.id === id && e.variant === variant);
      const m = ex && measure(ex);
      if (m) { max.push({ date: s.date, value: m.max }); vol.push({ date: s.date, value: m.vol }); }
    }
    return { max, vol };
  }, [sel, list]);

  return (
    <div className="screen with-nav">
      <div className="top"><p className="t-label">{list.length} {list.length === 1 ? 'seduta' : 'sedute'}</p><ThemeToggle /></div>
      <h1 className="t-display day">Storico</h1>

      {!list.length && <p className="empty">Qui trovi le sedute salvate e i grafici per esercizio. Inizia la prima dalla scheda Programma.</p>}

      {list.length > 0 && <MuscleRadar sessions={sessions} />}

      {sel && series && (
        <section className="ex">
          <label className="field"><span>Esercizio</span>
            <select value={sel[0]} onChange={(e) => setKey(e.target.value)}>
              {options.map(([k, o]) => <option key={k} value={k}>{o.name}</option>)}
            </select>
          </label>
          <LineChart title={METRICS[sel[1].type].max} points={series.max} unit={METRICS[sel[1].type].unit} />
          {METRICS[sel[1].type].vol && <LineChart title={METRICS[sel[1].type].vol!} points={series.vol} unit={METRICS[sel[1].type].volUnit} />}
          {series.max.length < 2 && <p className="t-label">Con una seduta sola c'è un punto: l'andamento compare dalla seconda.</p>}
        </section>
      )}

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

export function SessionDetail({ session, sessions, health }: { session: StoredSession; sessions: StoredSession[]; health: boolean }) {
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
            {readyToProgress(sessions, session.program, session.part, ex.id, ex.variant) && <ReadyBadge />}
          </article>
        );
      })}
      {session.notes && <p className="note">{session.notes}</p>}
      {health && <a className="btn wide" href={healthUrl(session)}>Aggiungi a Salute</a>}
    </div>
  );
}
