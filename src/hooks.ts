import { useEffect, useState } from 'react';

let ctx: AudioContext | null = null;
let keepAlive: AudioBufferSourceNode | null = null;

/** iOS può fermare un audio che tace e poi non farlo ripartire senza un tocco: finché serve, resta in riproduzione un segnale impercettibile. */
function startKeepAlive(c: AudioContext) {
  if (keepAlive) return;
  const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
  buffer.getChannelData(0).fill(0.00001);
  keepAlive = c.createBufferSource();
  keepAlive.buffer = buffer;
  keepAlive.loop = true;
  keepAlive.connect(c.destination);
  keepAlive.start();
}

/** Da chiamare dentro un tocco: iOS fa suonare solo dopo un gesto dell'utente. */
export function unlockAudio() {
  try {
    // Di default iOS ammutolisce il Web Audio con l'interruttore silenzioso: 'playback' lo fa suonare comunque.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    if (!ctx) {
      ctx = new AudioContext();
      // Dopo un'interruzione (telefonata, Siri, cambio app) prova a ripartire da solo.
      ctx.onstatechange = () => { if (keepAlive && ctx!.state !== 'running') void ctx!.resume().catch(() => {}); };
    }
    if (ctx.state !== 'running') void ctx.resume();
    startKeepAlive(ctx);
  } catch { /* niente audio su questo dispositivo */ }
}

/** A seduta chiusa libera l'audio, così l'eventuale musica può riprendere. */
export function releaseAudio() {
  try { keepAlive?.stop(); } catch { /* già fermo */ }
  keepAlive = null;
  void ctx?.suspend().catch(() => {});
}

function playBeep(c: AudioContext, times: number, freq: number) {
  for (let i = 0; i < times; i++) {
    const t = c.currentTime + i * 0.28;
    const osc = c.createOscillator(), gain = c.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(c.destination);
    osc.start(t); osc.stop(t + 0.24);
  }
}
export function beep(times = 1, freq = 880) {
  if (!ctx) return;
  const c = ctx;
  if (c.state === 'running') playBeep(c, times, freq);
  else void c.resume().then(() => playBeep(c, times, freq)).catch(() => {});
}

/** Tiene lo schermo acceso finché `active` è vero; lo richiede di nuovo quando torni sull'app. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null, off = false;
    const request = () => navigator.wakeLock.request('screen').then((l) => { if (off) void l.release(); else lock = l; }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => { off = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [active]);
}

/** Orologio che fa ridisegnare il componente; i timer calcolano sempre dall'ora vera, non contano i tick. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export function clock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
