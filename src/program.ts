import raw from './program.json';
import type { ExLog, ForzaEx, Location, Part, ProgramDef, ProgramId, Session, SetLog, Settings, StoredSession } from './types';

export const program = raw as unknown as {
  id: string; name: string; start: string; end: string;
  weekly: { palestra: number; casa: number; riposo: number };
  defaults: { restForza: number; restWarmup: number };
  programs: ProgramDef[];
};
export const programJson = JSON.stringify(raw, null, 2) + '\n';

const ORDER: ProgramId[] = ['A', 'B', 'C'];
export const getProgram = (id: ProgramId) => program.programs.find((p) => p.id === id)!;

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dayMs = 86400000;
const parseDay = (s: string) => new Date(s + 'T00:00:00').getTime();

/** Settimana del blocco (1-4) che contiene `day`, oppure prima/dopo. */
export function blockWeek(day: string): { state: 'before' | 'during' | 'after'; week: number; weeks: number; from: string; to: string } {
  const start = parseDay(program.start), end = parseDay(program.end), t = parseDay(day);
  const weeks = Math.round((end - start) / dayMs + 1) / 7;
  const state = t < start ? 'before' : t > end ? 'after' : 'during';
  const week = state === 'before' ? 1 : state === 'after' ? weeks : Math.floor((t - start) / dayMs / 7) + 1;
  const from = localDate(new Date(start + (week - 1) * 7 * dayMs));
  const to = localDate(new Date(start + (week * 7 - 1) * dayMs));
  return { state, week, weeks, from, to };
}

/** Il primo numero del target, o il più alto se è un intervallo: "10-15" → 15, "8 per gamba" → 8. */
export function targetReps(target: string): number | null {
  const m = target.match(/(\d+)(?:\s*-\s*(\d+))?/);
  return m ? Number(m[2] ?? m[1]) : null;
}

export const sortedDesc = (s: StoredSession[]) => [...s].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

/** Due rotazioni indipendenti A → B → C: una per la forza, una per l'EMOM. */
export function nextProgram(sessions: StoredSession[], part: Part): ProgramId {
  const last = sortedDesc(sessions).find((s) => s.part === part);
  return last ? ORDER[(ORDER.indexOf(last.program) + 1) % 3] : 'A';
}

export function lastSession(sessions: StoredSession[], prog: ProgramId, part: Part): StoredSession | undefined {
  return sortedDesc(sessions).find((s) => s.program === prog && s.part === part);
}

/** Lo stesso esercizio (stessa variante) nell'ultima seduta dello stesso programma in cui compare. */
export function lastExercise(sessions: StoredSession[], prog: ProgramId, part: Part, id: string, variant: Location): ExLog | undefined {
  for (const s of sortedDesc(sessions)) {
    if (s.program !== prog || s.part !== part) continue;
    const ex = s.exercises.find((e) => e.id === id && e.variant === variant && e.sets.some((x) => x.done));
    if (ex) return ex;
  }
}

export function describeSet(ex: Pick<ExLog, 'type'>, s: SetLog): string {
  switch (ex.type) {
    case 'peso_rip': return `${s.kg ?? '–'} kg × ${s.reps ?? '–'}`;
    case 'elastico_rip': return `${s.band || '–'} × ${s.reps ?? '–'}`;
    case 'corpo_rip': return `${s.reps ?? '–'}`;
    case 'tempo': return `${s.seconds ?? '–'}"`;
    case 'cardio': return `${s.minutes ?? '–'}'`;
  }
}

/** "60 kg × 8 · 8 · 8 · 7" quando carico o elastico non cambiano, altrimenti serie per serie. */
export function describeLast(ex: ExLog): string {
  const done = ex.sets.filter((s) => s.done);
  if (!done.length) return '';
  if (ex.type === 'peso_rip' && done.every((s) => s.kg === done[0].kg)) return `${done[0].kg ?? '–'} kg × ${done.map((s) => s.reps ?? '–').join(' · ')}`;
  if (ex.type === 'elastico_rip' && done.every((s) => s.band === done[0].band)) return `${done[0].band || '–'} × ${done.map((s) => s.reps ?? '–').join(' · ')}`;
  return done.map((s) => describeSet(ex, s)).join(' · ');
}

function prefill(prev: ExLog | undefined, i: number, restSec: number, seconds?: number): SetLog {
  const p = prev?.sets[i] ?? prev?.sets[prev.sets.length - 1];
  return { kg: p?.kg, reps: p?.reps, band: p?.band, seconds: p?.seconds ?? seconds, done: false, restSec };
}

export function forzaExercise(def: ForzaEx, variant: Location, prog: ProgramId, sessions: StoredSession[], settings: Settings, count = def.sets): ExLog {
  const v = def[variant];
  const prev = lastExercise(sessions, prog, 'forza', def.id, variant);
  const rest = settings.restByExercise[def.id] ?? settings.restForza;
  return {
    id: def.id, name: v.name, variant, block: 'forza', type: v.type, target: `${def.sets}x${v.target}`,
    sets: Array.from({ length: count }, (_, i) => prefill(prev, i, rest)),
  };
}

export function newSession(prog: ProgramId, part: Part, location: Location, sessions: StoredSession[], settings: Settings): Session {
  const def = getProgram(prog);
  const exercises: ExLog[] = [];
  if (part === 'forza') {
    const wu = def.forza.warmup;
    wu.exercises.forEach((e, idx) => {
      const prev = lastExercise(sessions, prog, 'forza', e.id, location);
      // Il coach scrive il recupero solo a fine giro: lo porta l'ultimo esercizio del giro.
      const rest = idx === wu.exercises.length - 1 ? settings.restByExercise[e.id] ?? settings.restWarmup : 0;
      exercises.push({
        id: e.id, name: e.name, variant: location, block: 'warmup', type: e.type, target: e.target,
        sets: Array.from({ length: wu.rounds }, (_, i) => prefill(prev, i, rest, e.seconds)),
      });
    });
    def.forza.exercises.forEach((e) => exercises.push(forzaExercise(e, location, prog, sessions, settings)));
  } else {
    def.emom.exercises.forEach((e) => {
      const prev = lastExercise(sessions, prog, 'emom', e.id, 'casa');
      exercises.push({
        id: e.id, name: e.name, variant: 'casa', block: 'emom', type: e.type, target: e.target,
        sets: Array.from({ length: def.emom.rounds }, (_, i) => prefill(prev, i, 0)),
      });
    });
    const c = def.emom.cardio;
    exercises.push({ id: c.id, name: `Cardio · ${c.name}`, variant: 'casa', block: 'cardio', type: 'cardio', target: `${c.minutes}'`, sets: [{ done: false, restSec: 0 }] });
  }
  const now = new Date();
  return { date: localDate(now), program: prog, part, location: part === 'emom' ? 'casa' : location, startedAt: now.toISOString(), endedAt: null, exercises, notes: '' };
}

/** Apre il Comando rapido che registra l'allenamento in Salute, passandogli la durata in minuti. */
export const HEALTH_SHORTCUT: Record<Part, string> = { forza: 'Salute forza', emom: 'Salute EMOM' };
export function healthUrl(s: Session): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(HEALTH_SHORTCUT[s.part])}&input=text&text=${minutesOf(s) ?? 1}`;
}

export const sessionId = (s: Session) => `${s.date}_${s.program}_${s.part}`;
export const partLabel = (part: Part) => (part === 'forza' ? 'Parte 1 · Warm-up + forza' : "Parte 2 · EMOM 20' + stretching");

const fmtDay = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
export function shortDay(date: string): string {
  const s = fmtDay.format(new Date(date + 'T00:00:00')).replace(/\./g, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function minutesOf(s: Session): number | null {
  return s.endedAt ? Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)) : null;
}
