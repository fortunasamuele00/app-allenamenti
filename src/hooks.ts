import { useEffect, useState } from 'react';

let ctx: AudioContext | null = null;
/** Da chiamare dentro un tocco: iOS fa suonare solo dopo un gesto dell'utente. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* niente audio su questo dispositivo */ }
}
export function beep(times = 1, freq = 880) {
  if (!ctx) return;
  for (let i = 0; i < times; i++) {
    const t = ctx.currentTime + i * 0.28;
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.24);
  }
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
