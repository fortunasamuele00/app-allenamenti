export type ExType = 'peso_rip' | 'elastico_rip' | 'corpo_rip' | 'tempo' | 'cardio';
export type Part = 'forza' | 'emom';
export type Location = 'palestra' | 'casa';
export type ProgramId = 'A' | 'B' | 'C';
export type Block = 'warmup' | 'forza' | 'emom' | 'cardio';

export interface SetLog {
  kg?: number;
  reps?: number;
  band?: string;
  seconds?: number;
  minutes?: number;
  done: boolean;
  restSec: number;
}

export interface ExLog {
  id: string;
  name: string;
  variant: Location;
  block: Block;
  type: ExType;
  target: string;
  sets: SetLog[];
}

/** Il file che finisce in `sessions/` sul repo dati. */
export interface Session {
  date: string;
  program: ProgramId;
  part: Part;
  location: Location;
  startedAt: string;
  endedAt: string | null;
  exercises: ExLog[];
  notes: string;
}

/** La seduta com'è tenuta sul telefono: stessa forma, più chiave e stato di sync. */
export interface StoredSession extends Session {
  id: string;
  synced: boolean;
}

export interface VariantDef {
  name: string;
  type: ExType;
  target: string;
  note?: string;
  substitution?: boolean;
}

export interface SimpleEx extends VariantDef {
  id: string;
  coach?: string;
  seconds?: number;
}

export interface ForzaEx {
  id: string;
  sets: number;
  palestra: VariantDef;
  casa: VariantDef;
}

export interface ProgramDef {
  id: ProgramId;
  name: string;
  forza: {
    minutes: number;
    warmup: { rounds: number; restSec: number; exercises: SimpleEx[] };
    exercises: ForzaEx[];
  };
  emom: {
    minutes: number;
    rounds: number;
    exercises: SimpleEx[];
    stretching: string;
    cardio: { id: string; name: string; minutes: number; note: string };
  };
}

export interface Settings {
  owner: string;
  repo: string;
  token: string;
  restForza: number;
  restWarmup: number;
  restByExercise: Record<string, number>;
}
