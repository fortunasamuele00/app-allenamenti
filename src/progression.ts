import { sortedDesc, targetReps } from './program';
import type { ExLog, Location, Part, ProgramId, StoredSession } from './types';

const lastDoneReps = (ex: ExLog) => [...ex.sets].reverse().find((s) => s.done && s.reps != null)?.reps;

/**
 * Regola del file del coach: se nell'ultima serie fai almeno 2 ripetizioni in più
 * del previsto per due sedute di fila, sei pronto a salire. Vale solo per gli
 * esercizi a ripetizioni; non cambia mai il programma.
 */
export function readyToProgress(sessions: StoredSession[], prog: ProgramId, part: Part, id: string, variant: Location): boolean {
  const logs: ExLog[] = [];
  for (const s of sortedDesc(sessions)) {
    if (s.program !== prog || s.part !== part) continue;
    const ex = s.exercises.find((e) => e.id === id && e.variant === variant);
    if (ex && lastDoneReps(ex) != null) logs.push(ex);
    if (logs.length === 2) break;
  }
  if (logs.length < 2) return false;
  return logs.every((ex) => {
    if (ex.type === 'tempo' || ex.type === 'cardio') return false;
    const t = targetReps(ex.target.replace(/^\d+x/, ''));
    return t != null && lastDoneReps(ex)! >= t + 2;
  });
}
