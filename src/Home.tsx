import { useEffect, useState } from 'react';
import { db } from './db';
import { blockWeek, F20, getProgram, localDate, partLabel, program, SEQ, sequenceState, sortedDesc } from './program';
import { syncMotivo, useSync } from './sync';
import type { Location, Part, ProgramId, Session, Settings, StoredSession } from './types';
import { ThemeToggle } from './theme';
import { DangerButton, Icon, muscleSummary } from './ui';
import { Link } from './nav';

const fmtToday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function SyncChip() {
  const s = useSync();
  const text = !s.configured ? 'Sync da configurare' : s.busy ? 'Sincronizzo' : s.pending ? `${s.pending} in coda` : 'Salvato';
  const tone = !s.configured ? 'off' : s.pending ? 'wait' : 'ok';
  return <Link className={`sync ${tone}`} to="#/impostazioni">{text}</Link>;
}

/** Il giro della sequenza: le fatte diventano arancioni, quella che tocca ha il bordo, il riposo in fondo. */
export function SeqStrip({ index, done, rest = false }: { index: number; done: number; rest?: boolean }) {
  const n = rest ? SEQ.length : done;
  return (
    <section className="seq" aria-label={`Giro: ${n} di ${SEQ.length} fatte`}>
      <div className="week-h"><h2 className="t-head">Il giro</h2><span>{n} di {SEQ.length}</span></div>
      <ol>
        {SEQ.map((x, i) => (
          <li key={i} className={rest || i < done ? 'd' : i === index ? 'now' : ''}><small>{x.part === 'forza' ? 'Forza' : 'EMOM'}</small><b>{x.program}</b></li>
        ))}
        <li className={`rest${rest ? ' now' : ''}`}><small>Riposo</small><b>–</b></li>
      </ol>
    </section>
  );
}

/** Frasi di partenza, una al giorno, finché non scrivi la tua in Impostazioni. */
const MOTTI = [
  'Il te di fra sei mesi ti sta guardando adesso.',
  'Il livello sale solo se ti presenti.',
  'Venti minuti. Il resto è una scusa.',
  'Nessuno è diventato forte nei giorni in cui ha saltato.',
  'Lui si è allenato anche oggi. E tu?',
  'Una seduta alla volta. Oggi tocca a questa.',
];
/** Un passo a caso da 1 a n-1 ogni giorno a partire da una data fissa: casuale, stabile nel giorno, mai uguale a ieri. */
function pick(day: number, n: number): number {
  if (n < 2) return 0;
  const h = (x: number) => { let v = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b); v ^= v >>> 13; v = Math.imul(v, 0xc2b2ae35); v ^= v >>> 16; return v >>> 0; };
  let i = 0;
  for (let d = 20000; d <= day; d++) i = (i + 1 + (h(d) % (n - 1))) % n;
  return i;
}
const fmtAgo = (days: number) => (days === 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`);

/** La spinta ad allenarsi: la tua frase, la tua immagine, e da quanto non ti alleni. */
function Motivo({ settings, sessions }: { settings: Settings; sessions: StoredSession[] }) {
  const [imgs, setImgs] = useState<string[]>([]);
  useEffect(() => {
    const load = () => Promise.all([db.motivoImgs(), db.motivoRepo()]).then(([mine, repo]) => setImgs([...mine, ...Object.keys(repo).sort().map((k) => repo[k])])).catch(() => setImgs([]));
    void load();
    void syncMotivo().then((changed) => { if (changed) void load(); });
  }, []);
  const today = new Date();
  const dayN = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000);
  // Una a caso ma fissa per tutto il giorno, e mai la stessa di ieri se ce n'è più d'una.
  const img = imgs.length ? imgs[pick(dayN, imgs.length)] : null;
  const text = settings.motto.trim() || MOTTI[dayN % MOTTI.length];
  const last = sortedDesc(sessions)[0];
  const ago = last ? Math.round((new Date(localDate(today) + 'T00:00:00').getTime() - new Date(last.date + 'T00:00:00').getTime()) / 86400000) : null;
  return (
    <Link className="motivo" to="#/impostazioni" aria-label={`${text} Tocca per cambiarla.`}>
      {img && <span className="motivo-img" style={{ backgroundImage: `url(${img})` }} />}
      <span className="motivo-t">
        <q>{text}</q>
        {ago != null && <small className={ago >= 2 ? 'warn' : ''}>Ultimo allenamento: {fmtAgo(ago)}</small>}
      </span>
    </Link>
  );
}

export function Home({ sessions, settings, draft, onStart, onDiscard, toast }: {
  sessions: StoredSession[]; settings: Settings; draft: Session | null; toast: string | null; onDiscard: () => void;
  onStart: (p: ProgramId, part: Part, loc: Location) => void;
}) {
  const today = new Date();
  const wk = blockWeek(localDate(today));
  const seq = sequenceState(sessions);
  const step = SEQ[seq.index];
  const cur = getProgram(step.program);
  // Dopo l'ultima della sequenza c'è un giorno di riposo: lo dice, ma non blocca.
  const yesterday = localDate(new Date(today.getTime() - 86400000));
  const closed = seq.index === 0 && seq.last;
  const rest = closed && seq.last!.date === localDate(today) ? 'Giro chiuso: domani riposo, poi'
    : closed && seq.last!.date === yesterday ? 'Oggi riposo, poi' : null;
  // Dove fai la forza si sceglie qui, prima di entrare: parte da dove l'hai fatta l'ultima volta.
  const [loc, setLocState] = useState<Location>(() => {
    try { const v = localStorage.getItem('dove-forza'); if (v === 'palestra' || v === 'casa') return v; } catch { /* nessuna preferenza */ }
    return sortedDesc(sessions).find((s) => s.part === 'forza')?.location ?? 'palestra';
  });
  const setLoc = (l: Location) => { setLocState(l); try { localStorage.setItem('dove-forza', l); } catch { /* resta per questa apertura */ } };
  const where: Location = step.part === 'emom' ? 'casa' : loc;
  const head = wk.state === 'before' ? `${program.name} · inizia ${/^(1|8|11) /.test(fmtShort.format(new Date(program.start + 'T00:00:00'))) ? "l'" : 'il '}${fmtShort.format(new Date(program.start + 'T00:00:00')).replace('.', '')}`
    : wk.state === 'after' ? `${program.name} · blocco concluso` : `${program.name} · settimana ${wk.week} di ${wk.weeks}`;

  return (
    <div className="screen with-nav">
      <div className="top"><p className="t-label">{head}</p><span className="top-r"><SyncChip /><ThemeToggle /></span></div>
      <h1 className="t-display day">{cap(fmtToday.format(today))}<br />{fmtDate.format(today)}</h1>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
        </div>
      )}

      {draft && (
        <div className="resume">
          <span><b>Seduta aperta</b><small>{draft.program} · {partLabel(draft.part)}</small></span>
          <Link className="btn ink" to="#/seduta">Riprendi</Link>
          <DangerButton label="Scarta" confirmLabel="Tocca ancora per scartarla" onConfirm={onDiscard} />
        </div>
      )}

      <article className={`go${step.part === 'emom' || loc === 'casa' ? ' casa' : ''}`}>
        <div className="go-top">
          <p className="go-k">{rest ?? 'Tocca a'}</p>
          {step.part === 'forza' ? (
            <div className="where" role="group" aria-label="Dove fai la forza">
              {(['palestra', 'casa'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={loc === l} aria-label={l === 'palestra' ? 'In palestra' : 'A casa'} onClick={() => setLoc(l)}><Icon name={l === 'palestra' ? 'gym' : 'home'} /></button>
              ))}
            </div>
          ) : <span className="where-fixed" aria-label="A casa"><Icon name="home" /></span>}
        </div>
        <h2><b>{cur.id}</b>{step.part === 'forza' ? 'Forza' : 'EMOM'} · {cur.name}</h2>
        <p className="go-m">{step.part === 'forza'
          ? (settings.forza20 ? `Warm-up + forza in circuito · ${F20.minutes}'` : `Warm-up + forza · circa ${cur.forza.minutes}'`)
          : `EMOM ${cur.emom.minutes}' + stretching · circa 25'`}</p>
        <p className="go-mu">{muscleSummary(step.part === 'forza' ? cur.forza.exercises.map((e) => `${e.id}:${loc}`) : cur.emom.exercises.map((e) => e.id)).join(' · ')}</p>
        <p className="go-l">{step.part === 'forza'
          ? cur.forza.exercises.map((e) => `${e[loc].name} ${settings.forza20 ? Math.min(e.sets, F20.rounds) : e.sets} × ${e[loc].target}`).join(' · ')
          : cur.emom.exercises.map((e) => e.name).join(' · ')}</p>
        <button className={`btn ${step.part === 'forza' ? 'pri' : 'ink'}`} type="button" onClick={() => onStart(cur.id, step.part, where)}>{where === 'casa' ? 'Inizia a casa' : 'Inizia in palestra'}</button>
      </article>

      <SeqStrip index={seq.index} done={seq.done} rest={!!rest} />


      <Motivo settings={settings} sessions={sessions} />

      <Link className="all" to="#/programma">Tutto il programma<Icon name="chev" /></Link>
    </div>
  );
}
