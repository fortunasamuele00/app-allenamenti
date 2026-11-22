import { useEffect, useState, type ReactNode } from 'react';
import { clock, useNow } from './hooks';
import guideData from './guide.json';
import feelData from './feel.json';
import { targetReps } from './program';
import type { ExLog, SetLog } from './types';

const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chev: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  pause: 'M8 5v14M16 5v14',
  play: 'M8 5l11 7-11 7z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  gym: 'M3 12h18M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5',
  home: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z',
  up: 'M12 19V5M6 11l6-6 6 6',
  rows: 'M4 6h16M4 12h16M4 18h10',
  chart: 'M5 19v-8M12 19V5M19 19v-5',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z',
  info: 'M12 11v6M12 7.5v.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
};
export type IconName = keyof typeof ICONS;
export function Icon({ name }: { name: IconName }) {
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[name]} /></svg>;
}

const show = (v: number | undefined) => (v == null ? '' : String(v).replace('.', ','));

export function NumField(p: { value: number | undefined; onChange: (v: number | undefined) => void; unit: string; label: string; decimal?: boolean; placeholder?: string }) {
  const [txt, setTxt] = useState(show(p.value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setTxt(show(p.value)); }, [p.value, focused]);
  return (
    <label className="f">
      <input
        inputMode={p.decimal ? 'decimal' : 'numeric'} value={txt} placeholder={p.placeholder} aria-label={p.label} autoComplete="off"
        onFocus={(e) => { setFocused(true); e.target.select(); }} onBlur={() => setFocused(false)}
        onChange={(e) => {
          const t = e.target.value.replace(p.decimal ? /[^\d.,]/g : /\D/g, '');
          setTxt(t);
          const n = parseFloat(t.replace(',', '.'));
          p.onChange(Number.isFinite(n) ? n : undefined);
        }}
      />
      <i>{p.unit}</i>
    </label>
  );
}

export function TextField(p: { value: string | undefined; onChange: (v: string) => void; unit: string; label: string; placeholder?: string }) {
  return (
    <label className="f">
      <input value={p.value ?? ''} placeholder={p.placeholder} aria-label={p.label} autoComplete="off" autoCapitalize="none" onChange={(e) => p.onChange(e.target.value)} />
      <i>{p.unit}</i>
    </label>
  );
}

/** Gli elastici che ci sono: si sceglie da una tendina, niente testo libero. */
export const BANDS = [
  { value: 'no', label: 'No elastico' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const;

export function BandField(p: { value: string | undefined; onChange: (v: string) => void; label: string }) {
  const known = BANDS.some((b) => b.value === p.value);
  return (
    <label className="f band-f">
      <select value={p.value ?? ''} aria-label={p.label} onChange={(e) => p.onChange(e.target.value)}>
        {!p.value && <option value="" disabled>Scegli</option>}
        {/* Un valore vecchio scritto a mano resta visibile finché non ne scegli uno nuovo. */}
        {p.value && !known && <option value={p.value}>{p.value}</option>}
        {BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
      </select>
      <i>elastico<svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" /></svg></i>
    </label>
  );
}

/** I campi di una serie, scelti dal tipo di esercizio. */
export function SetFields({ ex, set, onChange }: { ex: ExLog; set: SetLog; onChange: (patch: Partial<SetLog>) => void }) {
  const t = targetReps(ex.target.replace(/^\d+x/, ''));
  const hint = t == null ? undefined : String(t);
  switch (ex.type) {
    case 'peso_rip': return (<>
      <NumField value={set.kg} onChange={(kg) => onChange({ kg })} unit="kg" label="Chili" decimal />
      <NumField value={set.reps} onChange={(reps) => onChange({ reps })} unit="rip" label="Ripetizioni" placeholder={hint} />
    </>);
    case 'elastico_rip': return (<>
      <BandField value={set.band} onChange={(band) => onChange({ band })} label="Elastico" />
      <NumField value={set.reps} onChange={(reps) => onChange({ reps })} unit="rip" label="Ripetizioni" placeholder={hint} />
    </>);
    case 'corpo_rip': return <NumField value={set.reps} onChange={(reps) => onChange({ reps })} unit="rip" label="Ripetizioni" placeholder={hint} />;
    case 'tempo': return <NumField value={set.seconds} onChange={(seconds) => onChange({ seconds })} unit="secondi" label="Secondi" placeholder={hint} />;
    case 'cardio': return <NumField value={set.minutes} onChange={(minutes) => onChange({ minutes })} unit="minuti" label="Minuti" placeholder={hint} />;
  }
}
export const setCols = (ex: ExLog) => (ex.type === 'peso_rip' ? '' : ex.type === 'elastico_rip' ? ' wide' : ' one');

export function Check({ done, onClick, label }: { done: boolean; onClick: () => void; label: string }) {
  return <button className="chk" type="button" aria-pressed={done} aria-label={label} onClick={onClick}><Icon name="check" /></button>;
}

/** Il recupero scritto tra una serie e l'altra: un tocco lo apre, ±15" lo cambia per quell'esercizio. */
export function GapRest({ sec, onChange }: { sec: number; onChange: (sec: number) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="gap" type="button" onClick={() => setOpen(true)} aria-label={`Recupero ${sec} secondi, tocca per cambiarlo`}>recupero {sec}"</button>;
  return (
    <div className="gap-edit">
      <button type="button" onClick={() => onChange(Math.max(0, sec - 15))} aria-label="15 secondi in meno">−15"</button>
      <span>recupero {sec}"</span>
      <button type="button" onClick={() => onChange(sec + 15)} aria-label="15 secondi in più">+15"</button>
      <button type="button" className="ok" onClick={() => setOpen(false)}>Fatto</button>
    </div>
  );
}

export interface Rest { endAt: number; total: number; label: string }

export function RestDock({ rest, onAdjust, onSkip, onDone }: { rest: Rest; onAdjust: (deltaSec: number) => void; onSkip: () => void; onDone: () => void }) {
  const now = useNow(true);
  const left = (rest.endAt - now) / 1000;
  useEffect(() => { if (left <= 0) onDone(); }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="dock" role="timer" aria-label="Recupero">
      <div className="dock-h">
        <div><p>{rest.label}</p><p className="dock-t">{clock(left)}</p></div>
        <button className="dock-skip" type="button" onClick={onSkip}>Salta</button>
      </div>
      <div className="drain">
        <button type="button" onClick={() => onAdjust(-15)}>−15"</button>
        <div className="cap"><b style={{ width: `${Math.max(0, Math.min(100, (left / rest.total) * 100))}%` }} /></div>
        <button type="button" onClick={() => onAdjust(15)}>+15"</button>
      </div>
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h3 className="t-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="bar">
      <button className="bar-back" type="button" onClick={onBack} aria-label="Indietro"><Icon name="back" /></button>
      <p className="t-head">{title}</p>
      {right}
    </div>
  );
}

/** Consiglio per far più fatica quando un esercizio è diventato facile. */
export function TipCard({ tip }: { tip: { title: string; text: string } | null }) {
  if (!tip) return null;
  return <div className="tip"><p><Icon name="up" />{tip.title}</p><small>{tip.text}</small></div>;
}

export function ReadyBadge({ text = 'Pronto a salire' }: { text?: string }) {
  return <span className="badge"><Icon name="up" />{text}</span>;
}

/** Azione che non si annulla: il primo tocco arma il pulsante, il secondo la esegue. Niente finestre di sistema. */
export function DangerButton({ label, confirmLabel, onConfirm, className = 'link danger' }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  return (
    <button className={`${className}${armed ? ' armed' : ''}`} type="button" onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}

export interface GuideRef { key: string; name: string; note?: string; coach?: string }
const GUIDE = guideData.entries as Record<string, { how: string[]; avoid: string }>;
const FEEL = feelData.entries as Record<string, { muscles: string[]; feel: string }>;
export const feelOf = (key: string) => FEEL[key];

/** Muscoli di un gruppo di esercizi, in ordine di quante volte compaiono. */
export function muscleSummary(keys: string[]): string[] {
  const n = new Map<string, number>();
  keys.forEach((k, i) => FEEL[k]?.muscles.forEach((m, j) => n.set(m, (n.get(m) ?? 0) + (j === 0 ? 2 : 1) - i * 0.001)));
  return [...n].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

export function Muscles({ list }: { list: string[] }) {
  return <span className="mus">{list.map((m, i) => <i key={m} className={i === 0 ? 'p' : ''}>{m}</i>)}</span>;
}

/** Il nome dell'esercizio come pulsante: apre la spiegazione di come si fa. */
export function NameButton({ guide, onOpen, className }: { guide: GuideRef; onOpen: (g: GuideRef) => void; className?: string }) {
  return (
    <button className={`namebtn ${className ?? ''}`} type="button" onClick={() => onOpen(guide)} aria-label={`${guide.name}: come si fa`}>
      <span>{guide.name}</span><Icon name="info" />
    </button>
  );
}

export function GuideSheet({ guide, onClose }: { guide: GuideRef; onClose: () => void }) {
  const g = GUIDE[guide.key];
  return (
    <Sheet title={guide.name} onClose={onClose}>
      {guide.coach && guide.coach !== guide.name && <p className="note">Al posto di: {guide.coach} (coach).</p>}
      {FEEL[guide.key] && (
        <div className="guide-feel">
          <p className="t-label">Dove lo devi sentire</p>
          <Muscles list={FEEL[guide.key].muscles} />
          <p>{FEEL[guide.key].feel}</p>
        </div>
      )}
      {guide.note && <div className="guide-note"><p className="t-label">Dal tuo programma</p><p>{guide.note}</p></div>}
      {g && (<>
        <p className="t-label">Come si fa</p>
        <ol className="guide-how">{g.how.map((h) => <li key={h}>{h}</li>)}</ol>
        <p className="t-label">Da evitare</p>
        <p className="guide-avoid">{g.avoid}</p>
      </>)}
      <p className="guide-src">Indicazioni generali, non scritte dal coach. Se senti dolore, fermati.</p>
      <button className="btn ink wide" type="button" onClick={onClose}>Chiudi</button>
    </Sheet>
  );
}
