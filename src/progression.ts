import { sortedDesc, targetReps } from './program';
import type { ExLog, Location, Part, ProgramId, StoredSession } from './types';

const doneSets = (ex: ExLog) => ex.sets.filter((s) => s.done);
const lastDoneReps = (ex: ExLog) => [...doneSets(ex)].reverse().find((s) => s.reps != null)?.reps;
const maxSeconds = (ex: ExLog) => Math.max(0, ...doneSets(ex).map((s) => s.seconds ?? 0));
/** L'elastico usato nell'esercizio: quello dell'ultima serie fatta. */
const bandOf = (ex: ExLog) => [...doneSets(ex)].reverse().find((s) => s.band)?.band ?? 'no';

/**
 * "Facile": nell'ultima serie almeno 2 ripetizioni in più del previsto (regola del vecchio file del coach).
 * Per gli esercizi a tempo: almeno 10 secondi oltre il previsto. null = non si può dire (niente dati).
 */
function easy(ex: ExLog): boolean | null {
  if (ex.type === 'cardio') return null;
  const t = targetReps(ex.target.replace(/^\d+x/, ''));
  if (t == null) return null;
  if (ex.type === 'tempo') { const s = maxSeconds(ex); return s ? s >= t + 10 : null; }
  const r = lastDoneReps(ex);
  return r == null ? null : r >= t + 2;
}

/** Varianti più dure per gli esercizi senza carico, dove alzare il peso non si può. */
const HARDER: Record<string, string> = {
  'a-emom-step-up': 'Gradino più alto, oppure elastico sotto il piede e maniglie sulle spalle.',
  'a-emom-piegamenti': 'Piedi rialzati sul puff o su una sedia.',
  'b-emom-burpee': 'Alla fine di ogni burpee salta portando le ginocchia al petto.',
  'b-emom-crunch': 'Braccia tese dietro la testa per tutta la serie.',
  'c-emom-affondi-braccia-alte': "Tieni una bottiglia d'acqua per mano, braccia tese in alto.",
  'c-emom-hollow-hold': 'Gambe tese e più vicine al pavimento, braccia sopra la testa.',
  'a-leg-curl:casa': "Una gamba sola, con lo stesso elastico.",
};

export interface Tip { title: string; text: string }

/**
 * Consiglio per tornare a far fatica quando un esercizio è diventato facile.
 * Serve che sia stato facile almeno 2 sedute di fila (con lo stesso elastico). Se resta facile,
 * ogni altre 2 sedute il consiglio sale di un gradino. Non cambia mai il programma.
 */
export function progressTip(sessions: StoredSession[], prog: ProgramId, part: Part, id: string, variant: Location): Tip | null {
  const logs: ExLog[] = [];
  for (const s of sortedDesc(sessions)) {
    if (s.program !== prog || s.part !== part) continue;
    const ex = s.exercises.find((e) => e.id === id && e.variant === variant);
    if (ex && easy(ex) != null) logs.push(ex);
  }
  if (!logs.length) return null;
  const band = bandOf(logs[0]);
  let streak = 0;
  for (const ex of logs) {
    // Cambiato elastico: da lì si ricomincia a contare.
    if (!easy(ex) || (ex.type === 'elastico_rip' && bandOf(ex) !== band)) break;
    streak++;
  }
  if (streak < 2) return null;

  const ex = logs[0];
  const harder = HARDER[id] ?? HARDER[`${id}:${variant}`];
  const steps: Tip[] = [];
  if (ex.type === 'peso_rip') {
    steps.push({ title: 'Alza il carico', text: "La prossima volta +2,5 kg (o il salto più piccolo che hai), anche se le ripetizioni scendono un po'." });
  } else if (ex.type === 'tempo') {
    steps.push({ title: 'Tieni 10 secondi in più', text: 'Allunga ogni tenuta di 10 secondi.' });
    if (harder) steps.push({ title: 'Versione più dura', text: harder });
  } else {
    if (ex.type === 'elastico_rip' && band !== 'hard') {
      steps.push({ title: band === 'medium' ? "Passa all'elastico hard" : "Passa all'elastico medium", text: 'Anche se fai qualche ripetizione in meno: è normale, poi risalgono.' });
    }
    steps.push({ title: "Pausa di 1-2'' nell'ultima serie", text: "Nell'ultima serie fermati 1-2 secondi nel punto più duro di ogni ripetizione." });
    steps.push({ title: 'Scendi in 3 secondi', text: 'In tutte le serie la parte di ritorno è lenta: conta 3 secondi.' });
    if (harder) steps.push({ title: 'Versione più dura', text: harder });
    steps.push({ title: '2 ripetizioni in più', text: 'Alza il tuo obiettivo di 2 ripetizioni in ogni serie, tenendo pausa e discesa lenta.' });
  }
  return steps[Math.min(Math.floor((streak - 2) / 2), steps.length - 1)];
}

export const readyToProgress = (...a: Parameters<typeof progressTip>) => progressTip(...a) != null;
