import { useEffect, useRef, useState } from 'react';
import { beep, clock, unlockAudio, useNow, useWakeLock } from './hooks';
import { describeLast, getProgram, lastExercise } from './program';
import { readyToProgress } from './progression';
import type { ExLog, Session, SetLog, StoredSession } from './types';
import { DangerButton, GuideSheet, Icon, NameButton, NumField, ReadyBadge, Sheet, TextField, TopBar, type GuideRef } from './ui';

type Phase = 'ready' | 'run' | 'pause' | 'done';

function RoundField({ ex, set, onChange, unit }: { ex: ExLog; set: SetLog; onChange: (p: Partial<SetLog>) => void; unit: string }) {
  return ex.type === 'tempo'
    ? <NumField value={set.seconds} onChange={(seconds) => onChange({ seconds })} unit={unit} label={`${ex.name}, secondi`} />
    : <NumField value={set.reps} onChange={(reps) => onChange({ reps })} unit={unit} label={`${ex.name}, ripetizioni`} />;
}
const roundText = (exs: ExLog[], r: number) => exs.map((e) => (e.type === 'tempo' ? e.sets[r].seconds : e.sets[r].reps) ?? '–').join(' · ');

export function EmomScreen({ draft, setDraft, sessions, onFinish, onDiscard }: {
  draft: Session; setDraft: (s: Session) => void; sessions: StoredSession[];
  onFinish: (s: Session) => void; onDiscard: () => void;
}) {
  const def = getProgram(draft.program).emom;
  const exs = draft.exercises.filter((e) => e.block === 'emom');
  const cardioIdx = draft.exercises.findIndex((e) => e.block === 'cardio');
  const n = exs.length, totalMin = def.minutes, totalMs = totalMin * 60000;

  // Se l'app viene riaperta a seduta già avviata, si riparte dal riepilogo.
  const [phase, setPhase] = useState<Phase>(exs.some((e) => e.sets.some((s) => s.done)) ? 'done' : 'ready');
  const [acc, setAcc] = useState(0);
  const [t0, setT0] = useState(0);
  const [editRound, setEditRound] = useState<number | null>(null);
  const [guide, setGuide] = useState<GuideRef | null>(null);
  const [stopping, setStopping] = useState(false);
  const guideOf = (id: string): GuideRef => { const e = def.exercises.find((x) => x.id === id)!; return { key: id, name: e.name, note: e.note, coach: e.coach }; };
  const now = useNow(phase === 'run');
  useWakeLock(phase !== 'done');

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const update = (fn: (d: Session) => void) => { const d = structuredClone(draftRef.current); fn(d); draftRef.current = d; setDraft(d); };
  const patch = (exId: string, r: number, p: Partial<SetLog>) => update((d) => { Object.assign(d.exercises.find((e) => e.id === exId)!.sets[r], p); });

  const elapsed = Math.min(totalMs, acc + (phase === 'run' ? Math.max(0, now - t0) : 0));
  const minute = Math.min(totalMin - 1, Math.floor(elapsed / 60000));
  const marked = useRef(0);

  // Scorre da solo: a ogni cambio di minuto suona, e il minuto appena finito risulta fatto.
  useEffect(() => {
    if (phase !== 'run') return;
    const finished = elapsed >= totalMs ? totalMin : minute;
    if (finished > marked.current) {
      update((d) => {
        for (let m = marked.current; m < finished; m++) d.exercises.filter((e) => e.block === 'emom')[m % n].sets[Math.floor(m / n)].done = true;
      });
      marked.current = finished;
      if (finished >= totalMin) { beep(3, 660); setAcc(totalMs); setPhase('done'); } else beep(1);
    }
  }, [minute, elapsed >= totalMs, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { unlockAudio(); beep(1); setT0(Date.now()); setPhase('run'); };
  const pause = () => { setAcc(elapsed); setPhase('pause'); };

  if (phase === 'done') {
    const cardio = cardioIdx >= 0 ? draft.exercises[cardioIdx] : null;
    return (
      <div className="screen">
        <TopBar title={`${draft.program} · EMOM ${totalMin}'`} onBack={() => { location.hash = '#/'; }} />
        <h1 className="t-display sum-h">Com'è andata</h1>
        <p className="t-label">Ripetizioni per giro. Correggi quello che serve, poi salva.</p>
        {exs.map((ex) => {
          const last = lastExercise(sessions, draft.program, 'emom', ex.id, 'casa');
          return (
            <article className="ex" key={ex.id}>
              <div className="ex-h"><h3 className="t-title"><NameButton guide={guideOf(ex.id)} onOpen={setGuide} /></h3><span>{ex.target}</span></div>
              <p className="last"><span>Ultima volta</span>{last ? describeLast(last) : 'prima seduta'}</p>
              {readyToProgress(sessions, draft.program, 'emom', ex.id, 'casa') && <ReadyBadge />}
              {ex.type === 'elastico_rip' && (
                <div className="band"><TextField value={ex.sets[0].band} unit="elastico" label={`Elastico per ${ex.name}`}
                  onChange={(band) => update((d) => d.exercises.find((e) => e.id === ex.id)!.sets.forEach((s) => { s.band = band; }))} /></div>
              )}
              <div className="rounds">
                {ex.sets.map((s, r) => <RoundField key={r} ex={ex} set={s} unit={`giro ${r + 1}`} onChange={(p) => patch(ex.id, r, p)} />)}
              </div>
            </article>
          );
        })}
        {cardio && (
          <article className="ex">
            <div className="ex-h"><h3 className="t-title">{cardio.name}</h3><span>{cardio.target}</span></div>
            <p className="note">Facoltativo. {def.cardio.note}</p>
            <div className="band"><NumField value={cardio.sets[0].minutes} unit="minuti" label="Minuti di cardio"
              onChange={(minutes) => update((d) => { d.exercises[cardioIdx].sets[0].minutes = minutes; })} /></div>
          </article>
        )}
        <p className="remind">Ora {def.stretching}.</p>
        <label className="field"><span>Note (facoltative)</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => update((d) => { d.notes = e.target.value; })} />
        </label>
        <button className="btn pri wide" type="button" onClick={() => onFinish(draftRef.current)}>Salva seduta</button>
        <DangerButton label="Scarta seduta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />
        {guide && <GuideSheet guide={guide} onClose={() => setGuide(null)} />}
      </div>
    );
  }

  const cur = exs[minute % n], next = minute + 1 < totalMin ? exs[(minute + 1) % n] : null;
  const round = Math.floor(minute / n);
  const inMinute = (elapsed - minute * 60000) / 1000;
  const lastRound = round - 1;

  return (
    <div className="screen emom">
      <div className="emom-top">
        <p className="t-head">{draft.program} · EMOM {totalMin}'</p>
        <button type="button" onClick={() => {
          if (phase === 'ready') location.hash = '#/'; else setStopping(true);
        }}>{phase === 'ready' ? 'Esci' : 'Termina'}</button>
      </div>
      <div className="panel">
        <p className="t-label">Minuto {minute + 1} di {totalMin} · giro {round + 1} di {def.rounds}</p>
        <p className="t-num" role="timer">{clock(60 - inMinute)}</p>
        <h1><NameButton guide={guideOf(cur.id)} onOpen={setGuide} /></h1><p>{cur.target}</p>
      </div>
      <div className="next-ex">
        {next ? <><span><span className="t-label">Poi</span><br /><span className="t-head">{next.name}</span></span><span className="t-label">{next.target}</span></>
          : <span className="t-head">Ultimo minuto</span>}
      </div>

      <div className="mins" role="img" aria-label={`Fatti ${minute} minuti su ${totalMin}`}>
        {Array.from({ length: def.rounds }, (_, r) => (
          <div key={r}>{exs.map((_, i) => {
            const m = r * n + i;
            return <i key={i} className={m < minute ? 'd' : ''} style={m === minute ? { background: `linear-gradient(0deg,var(--accent) ${(inMinute / 60) * 100}%,var(--line) 0)` } : undefined} />;
          })}</div>
        ))}
      </div>
      <div className="mins-cap t-label">{Array.from({ length: def.rounds }, (_, r) => <span key={r}>{r === 0 || r === def.rounds - 1 ? `Giro ${r + 1}` : r + 1}</span>)}</div>

      {lastRound >= 0 && (
        <div className="round">
          <span><span className="t-label">Giro {lastRound + 1}</span>&ensp;{roundText(exs, lastRound)}</span>
          <button type="button" onClick={() => setEditRound(lastRound)}>{/\d/.test(roundText(exs, lastRound)) ? 'Modifica' : 'Inserisci'}</button>
        </div>
      )}
      {phase === 'run'
        ? <button className="btn ink wide" type="button" onClick={pause}><Icon name="pause" />Pausa</button>
        : <button className="btn pri wide" type="button" onClick={start}><Icon name="play" />{phase === 'ready' ? 'Avvia EMOM' : 'Riprendi'}</button>}

      {phase === 'ready' && <DangerButton label="Scarta seduta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />}
      {guide && <GuideSheet guide={guide} onClose={() => setGuide(null)} />}
      {stopping && (
        <Sheet title="Fermare l'EMOM?" onClose={() => setStopping(false)}>
          <p className="note">Il timer si ferma e passi al riepilogo con i minuti fatti finora.</p>
          <button className="btn ink wide" type="button" onClick={() => { setAcc(elapsed); setStopping(false); setPhase('done'); }}>Passa al riepilogo</button>
          <button className="btn wide" type="button" onClick={() => setStopping(false)}>Continua l'EMOM</button>
        </Sheet>
      )}

      {editRound != null && (
        <Sheet title={`Giro ${editRound + 1}`} onClose={() => setEditRound(null)}>
          {exs.map((ex) => (
            <div className="round-row" key={ex.id}>
              <span>{ex.name}<small>{ex.target}</small></span>
              <RoundField ex={ex} set={ex.sets[editRound]} unit={ex.type === 'tempo' ? 'secondi' : 'rip'} onChange={(p) => patch(ex.id, editRound, p)} />
            </div>
          ))}
          <button className="btn ink wide" type="button" onClick={() => setEditRound(null)}>Fatto</button>
        </Sheet>
      )}
    </div>
  );
}
