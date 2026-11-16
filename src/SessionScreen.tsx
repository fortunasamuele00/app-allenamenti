import { useEffect, useRef, useState } from 'react';
import { beep, releaseAudio, unlockAudio, useWakeLock } from './hooks';
import { describeLast, F20, forzaExercise, getProgram, lastExercise } from './program';
import { readyToProgress } from './progression';
import type { ExLog, ForzaEx, Location, Session, SetLog, Settings, StoredSession } from './types';
import { Check, DangerButton, GapRest, GuideSheet, Icon, NameButton, ReadyBadge, RestDock, SetFields, Sheet, TopBar, setCols, type GuideRef, type Rest } from './ui';
import { go } from './nav';

export function SessionScreen({ draft, setDraft, sessions, settings, saveSettings, onFinish, onDiscard }: {
  draft: Session; setDraft: (s: Session) => void; sessions: StoredSession[]; settings: Settings;
  saveSettings: (s: Settings) => void; onFinish: (s: Session) => void; onDiscard: () => void;
}) {
  const def = getProgram(draft.program);
  const [rest, setRest] = useState<Rest | null>(null);
  const [closing, setClosing] = useState(false);
  const [guide, setGuide] = useState<GuideRef | null>(null);
  useWakeLock(true);
  useEffect(() => releaseAudio, []);

  const f20 = draft.format === '20';
  // Si parte sempre dall'ultima versione, così due tocchi ravvicinati non si sovrascrivono.
  const latest = useRef(draft);
  latest.current = draft;
  const update = (fn: (d: Session) => void) => { const d = structuredClone(latest.current); fn(d); latest.current = d; setDraft(d); };
  const patchSet = (ei: number, si: number, patch: Partial<SetLog>) => update((d) => { Object.assign(d.exercises[ei].sets[si], patch); });

  // Spunta della serie: da qui parte il recupero.
  const check = (ei: number, si: number) => {
    unlockAudio();
    const ex = latest.current.exercises[ei], set = ex.sets[si], done = !set.done;
    // Spuntando una serie vuota vale il previsto, se è un numero solo; carico ed elastico scendono alle serie ancora vuote.
    const single = ex.target.replace(/^\d+x/, '').match(/^(\d+)(?!\s*-)/)?.[1];
    const fill: Partial<SetLog> = {};
    if (done && single && ex.type !== 'cardio') {
      if (ex.type === 'tempo') { if (set.seconds == null) fill.seconds = Number(single); }
      else if (set.reps == null) fill.reps = Number(single);
    }
    update((d) => {
      if (f20 && done && !d.clockStart) d.clockStart = new Date().toISOString();
      const sets = d.exercises[ei].sets;
      Object.assign(sets[si], fill, { done });
      if (done) sets.slice(si + 1).forEach((x) => { if (!x.done) { x.kg ??= sets[si].kg; if (!x.band) x.band = sets[si].band; } });
    });
    if (!done) return;
    if (set.restSec > 0) {
      const what = ex.block === 'warmup' ? `fine giro ${si + 1}` : f20 ? `giro ${si + 1} di ${ex.sets.length}, dopo ${ex.name}` : `${ex.name}, serie ${si + 1} di ${ex.sets.length}`;
      setRest({ endAt: Date.now() + set.restSec * 1000, total: set.restSec, label: `Recupero · ${what}` });
    }
  };
  const setRestFor = (ei: number, sec: number) => {
    update((d) => d.exercises[ei].sets.forEach((s) => { s.restSec = sec; }));
    // Nel circuito i recuperi sono fissi per posizione: cambiarli vale solo per questa seduta.
    if (f20) return;
    saveSettings({ ...settings, restByExercise: { ...settings.restByExercise, [draft.exercises[ei].id]: sec } });
  };
  // Cambiando variante si tengono numero di serie e recuperi della seduta (nel circuito dipendono dalla posizione).
  const rebuild = (old: ExLog, fdef: ForzaEx, variant: Location): ExLog => {
    const ex = forzaExercise(fdef, variant, draft.program, sessions, settings, old.sets.length);
    ex.sets.forEach((x, i) => { x.restSec = old.sets[i]?.restSec ?? x.restSec; });
    return ex;
  };
  const setVariant = (ei: number, variant: Location) => update((d) => {
    const fdef = def.forza.exercises.find((e) => e.id === d.exercises[ei].id)!;
    d.exercises[ei] = rebuild(d.exercises[ei], fdef, variant);
  });
  const setLocation = (loc: Location) => update((d) => {
    d.location = loc;
    d.exercises = d.exercises.map((e) => {
      if (e.block !== 'forza') return { ...e, variant: loc };
      if (e.variant === loc || e.sets.some((s) => s.done)) return e;
      return rebuild(e, def.forza.exercises.find((f) => f.id === e.id)!, loc);
    });
  });

  const all = draft.exercises.map((ex, ei) => ({ ex, ei }));
  const warm = all.filter((x) => x.ex.block === 'warmup');
  const forza = all.filter((x) => x.ex.block === 'forza');
  const rounds = warm[0]?.ex.sets.length ?? 0;
  const lastWarm = warm[warm.length - 1];

  return (
    <div className={`screen${rest ? ' with-dock' : ''}`}>
      <TopBar title={`${def.id} · ${def.name}`} onBack={() => { go('#/'); }} right={f20 ? <Clock start={draft.clockStart} /> : undefined} />
      <div className="seg" role="group" aria-label="Dove ti alleni">
        {(['palestra', 'casa'] as const).map((l) => (
          <button key={l} type="button" aria-pressed={draft.location === l} onClick={() => setLocation(l)}>{l === 'palestra' ? 'Palestra' : 'Casa'}</button>
        ))}
      </div>

      {f20 && <p className="note">Forza da {F20.minutes}': warm-up a 1 giro, poi i tre esercizi di fila per {F20.rounds} giri, {F20.restBetween}'' tra un esercizio e l'altro e {F20.restRound}'' a fine giro. Il cronometro parte alla prima spunta; allo scadere chiudi dove sei. Versione scelta da te, non dal coach.</p>}
      <h2 className="sec-h"><span className="t-title">Warm-up</span><span className="t-label">{rounds === 1 ? '1 giro' : `${rounds} giri`}</span></h2>
      {Array.from({ length: rounds }, (_, r) => (
        <article className="ex" key={r}>
          <p className="t-label round-h">Giro {r + 1}</p>
          {warm.map(({ ex, ei }) => (
            <div className={`set warm${ex.sets[r].done ? ' done' : ''}`} key={ex.id}>
              <span className="wname"><NameButton guide={{ key: ex.id, name: ex.name }} onOpen={setGuide} /><small>{ex.target}</small></span>
              <SetFields ex={ex} set={ex.sets[r]} onChange={(p) => patchSet(ei, r, p)} />
              <Check done={ex.sets[r].done} onClick={() => check(ei, r)} label={`${ex.name}, giro ${r + 1} fatto`} />
            </div>
          ))}
          {lastWarm && <GapRest sec={lastWarm.ex.sets[r].restSec} onChange={(s) => setRestFor(lastWarm.ei, s)} />}
        </article>
      ))}

      {f20 ? (<>
        <h2 className="sec-h"><span className="t-title">Forza in circuito</span><span className="t-label">{F20.rounds} giri</span></h2>
        <article className="ex">
          {forza.map(({ ex, ei }) => {
            const fdef = def.forza.exercises.find((e) => e.id === ex.id)!;
            const last = lastExercise(sessions, draft.program, 'forza', ex.id, ex.variant);
            const note = fdef[ex.variant].note;
            return (
              <div className="circ-ex" key={ex.id}>
                <div className="ex-h"><h3 className="t-title"><NameButton guide={{ key: `${ex.id}:${ex.variant}`, name: ex.name, note }} onOpen={setGuide} /></h3><span>{ex.sets.length} × {fdef[ex.variant].target}</span></div>
                <div className="seg" role="group" aria-label={`Variante di ${ex.name}`}>
                  {(['palestra', 'casa'] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={ex.variant === v} onClick={() => ex.variant !== v && setVariant(ei, v)}>{v === 'palestra' ? 'Palestra' : 'Casa'}</button>
                  ))}
                </div>
                <p className="last"><span>Ultima volta</span>{last ? describeLast(last) : 'prima seduta'}</p>
                {readyToProgress(sessions, draft.program, 'forza', ex.id, ex.variant) && <ReadyBadge />}
              </div>
            );
          })}
        </article>
        {Array.from({ length: Math.max(0, ...forza.map((x) => x.ex.sets.length)) }, (_, r) => (
          <article className="ex" key={`g${r}`}>
            <p className="t-label round-h">Giro {r + 1}</p>
            {forza.filter(({ ex }) => ex.sets[r]).map(({ ex, ei }, k) => (
              <div key={ex.id} className="circ-row">
                <p className="wname">{ex.name}<small>{ex.target.replace(/^\d+x/, '')}</small></p>
                <div className={`set${setCols(ex)}${ex.sets[r].done ? ' done' : ''}`}>
                  <span className="n">{k + 1}</span>
                  <SetFields ex={ex} set={ex.sets[r]} onChange={(p) => patchSet(ei, r, p)} />
                  <Check done={ex.sets[r].done} onClick={() => check(ei, r)} label={`${ex.name}, giro ${r + 1} fatto`} />
                </div>
                <GapRest sec={ex.sets[r].restSec} onChange={(sec) => update((d) => { d.exercises[ei].sets[r].restSec = sec; })} />
              </div>
            ))}
          </article>
        ))}
      </>) : (<>
      <h2 className="sec-h"><span className="t-title">Forza</span><span className="t-label">circa {def.forza.minutes}' in tutto</span></h2>
      {forza.map(({ ex, ei }) => {
        const fdef = def.forza.exercises.find((e) => e.id === ex.id)!;
        const last = lastExercise(sessions, draft.program, 'forza', ex.id, ex.variant);
        const note = fdef[ex.variant].note;
        return (
          <article className="ex" key={ex.id}>
            <div className="ex-h"><h3 className="t-title"><NameButton guide={{ key: `${ex.id}:${ex.variant}`, name: ex.name, note }} onOpen={setGuide} /></h3><span>{fdef.sets} × {fdef[ex.variant].target}</span></div>
            <div className="seg" role="group" aria-label={`Variante di ${ex.name}`}>
              {(['palestra', 'casa'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={ex.variant === v} onClick={() => ex.variant !== v && setVariant(ei, v)}>{v === 'palestra' ? 'Palestra' : 'Casa'}</button>
              ))}
            </div>
            {note && <p className="note">{note}</p>}
            <p className="last"><span>Ultima volta</span>{last ? describeLast(last) : 'prima seduta'}</p>
            {readyToProgress(sessions, draft.program, 'forza', ex.id, ex.variant) && <ReadyBadge />}
            {ex.sets.map((s, si) => (
              <div key={si}>
                <div className={`set${setCols(ex)}${s.done ? ' done' : ''}`}>
                  <span className="n">{si + 1}</span>
                  <SetFields ex={ex} set={s} onChange={(p) => patchSet(ei, si, p)} />
                  <Check done={s.done} onClick={() => check(ei, si)} label={`Serie ${si + 1} fatta`} />
                </div>
                {si < ex.sets.length - 1 && <GapRest sec={s.restSec} onChange={(sec) => setRestFor(ei, sec)} />}
              </div>
            ))}
            <div className="ex-f">
              <button className="btn" type="button" onClick={() => update((d) => { const sets = d.exercises[ei].sets; sets.push({ ...sets[sets.length - 1], done: false }); })}><Icon name="plus" />Serie</button>
              <button className="btn" type="button" disabled={ex.sets.length <= 1} onClick={() => update((d) => { d.exercises[ei].sets.pop(); })}><Icon name="minus" />Serie</button>
            </div>
          </article>
        );
      })}
      </>)}

      <button className="btn ink wide" type="button" onClick={() => setClosing(true)}>Termina seduta</button>

      {rest && (
        <RestDock rest={rest}
          onAdjust={(d) => setRest((r) => r && { ...r, endAt: r.endAt + d * 1000, total: Math.max(15, r.total + d) })}
          onSkip={() => setRest(null)}
          onDone={() => { beep(2); setRest(null); }} />
      )}

      {guide && <GuideSheet guide={guide} onClose={() => setGuide(null)} />}

      {closing && (
        <Sheet title="Termina seduta" onClose={() => setClosing(false)}>
          <label className="field"><span>Note (facoltative)</span>
            <textarea rows={3} value={draft.notes} onChange={(e) => update((d) => { d.notes = e.target.value; })} />
          </label>
          <button className="btn pri wide" type="button" onClick={() => onFinish(latest.current)}>Salva seduta</button>
          <button className="btn wide" type="button" onClick={() => setClosing(false)}>Continua ad allenarti</button>
          <DangerButton label="Scarta seduta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />
        </Sheet>
      )}
    </div>
  );
}

/** Conto alla rovescia della forza da 20': parte alla prima spunta, allo scadere suona una volta. */
function Clock({ start }: { start?: string }) {
  const [now, setNow] = useState(Date.now());
  const rang = useRef(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const total = F20.minutes * 60;
  const left = start ? Math.max(0, total - Math.floor((now - Date.parse(start)) / 1000)) : total;
  useEffect(() => { if (start && left === 0 && !rang.current) { rang.current = true; beep(3, 660); } }, [left, start]);
  const mm = String(Math.floor(left / 60)), ss = String(left % 60).padStart(2, '0');
  return <span className={`clock${left === 0 ? ' end' : ''}`} role="timer" aria-label={left === 0 ? 'Tempo finito' : `Mancano ${mm} minuti e ${ss} secondi`}>{left === 0 ? 'Tempo!' : `${mm}:${ss}`}</span>;
}
