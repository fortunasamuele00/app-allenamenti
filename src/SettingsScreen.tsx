import { useEffect, useState } from 'react';
import { db } from './db';
import { flush, restoreFromRepo, testConnection, useSync } from './sync';
import type { Settings } from './types';
import { HEALTH_SHORTCUT } from './program';
import { ThemeToggle } from './theme';
import { NumField } from './ui';

/** Rimpicciolisce la foto prima di salvarla: basta per lo sfondo e non pesa sul telefono. */
function shrink(file: File): Promise<string> {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1080 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Immagine non leggibile')); };
    im.src = url;
  });
}

function MotivoSettings({ settings, saveSettings }: { settings: Settings; saveSettings: (s: Settings) => Promise<void> }) {
  const [motto, setMotto] = useState(settings.motto);
  const [img, setImg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void db.motivoImg().then(setImg).catch(() => setImg(null)); }, []);
  return (
    <section className="ex">
      <h2 className="t-title">Motivazione</h2>
      <p className="note">La frase e l'immagine che vedi in home, sotto il giro. Scrivi chi vuoi diventare. Restano su questo telefono.</p>
      <label className="field"><span>La tua frase</span>
        <textarea rows={2} value={motto} placeholder="Vuota: una frase diversa ogni giorno" onChange={(e) => setMotto(e.target.value)} /></label>
      <button className="btn wide" type="button" disabled={motto === settings.motto} onClick={async () => { await saveSettings({ ...settings, motto }); setMsg('Frase salvata.'); }}>Salva la frase</button>
      {img && <div className="motivo img prev" style={{ backgroundImage: `url(${img})` }} />}
      <label className="btn wide file">{img ? 'Cambia immagine' : "Scegli un'immagine"}
        <input type="file" accept="image/*" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          try { const d = await shrink(f); await db.saveMotivoImg(d); setImg(d); setMsg('Immagine salvata.'); } catch (err) { setMsg(err instanceof Error ? err.message : String(err)); }
          e.target.value = '';
        }} /></label>
      {img && <button className="link danger" type="button" onClick={async () => { await db.saveMotivoImg(null); setImg(null); setMsg('Immagine tolta.'); }}>Togli l'immagine</button>}
      {msg && <p className="t-label" role="status">{msg}</p>}
    </section>
  );
}

export function SettingsScreen({ settings, saveSettings, onRestored }: { settings: Settings; saveSettings: (s: Settings) => Promise<void>; onRestored: () => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const sync = useSync();
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const text = (k: 'owner' | 'repo' | 'token') => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="screen with-nav">
      <div className="top"><span /><ThemeToggle /></div>
      <h1 className="t-display day">Impostazioni</h1>

      <MotivoSettings settings={settings} saveSettings={saveSettings} />

      <section className="ex">
        <h2 className="t-title">GitHub</h2>
        <p className="note">Ogni seduta salvata diventa un file JSON nel repo privato. Il token resta su questo telefono.</p>
        <label className="field"><span>Utente GitHub</span><input {...text('owner')} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        <label className="field"><span>Repo dei dati</span><input {...text('repo')} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        <label className="field"><span>Token fine-grained</span><input {...text('token')} type="password" autoComplete="off" spellCheck={false} />
          <small>Solo questo repo, permesso Contents in lettura e scrittura.</small></label>
        <button className="btn pri wide" type="button" disabled={!dirty} onClick={async () => { await saveSettings(form); setMsg('Impostazioni salvate.'); void flush(); }}>Salva impostazioni</button>
        <button className="btn wide" type="button" onClick={async () => { setMsg('Provo…'); setMsg(await testConnection(form)); }}>Prova il collegamento</button>
        {msg && <p className="t-label" role="status">{msg}</p>}
      </section>

      <section className="ex">
        <h2 className="t-title">Sync</h2>
        <p className="note">{!sync.configured ? 'Non configurata: le sedute restano sul telefono e in coda.' : sync.pending ? `${sync.pending} ${sync.pending === 1 ? 'salvataggio' : 'salvataggi'} in coda.` : 'Tutto salvato sul repo.'}</p>
        {sync.error && <p className="err" role="alert">{sync.error}</p>}
        <button className="btn wide" type="button" disabled={sync.busy || !sync.configured} onClick={() => void flush()}>{sync.busy ? 'Sincronizzo…' : 'Sincronizza ora'}</button>
        <p className="note">Telefono nuovo o app reinstallata? Scarica dal repo le sedute che qui mancano: tornano storico, progressioni e turno A→B→C.</p>
        <button className="btn wide" type="button" disabled={restoring || !sync.configured} onClick={async () => { setRestoring(true); setRestoreMsg('Scarico le sedute…'); const m = await restoreFromRepo(); await onRestored(); setRestoreMsg(m); setRestoring(false); }}>{restoring ? 'Recupero…' : 'Recupera le sedute da GitHub'}</button>
        {restoreMsg && <p className="t-label" role="status">{restoreMsg}</p>}
      </section>

      <section className="ex">
        <h2 className="t-title">Forza</h2>
        <p className="note">Da 20': warm-up a 1 giro e i tre esercizi in circuito per 3 giri, con cronometro. Classica: come da scheda del coach, warm-up a 3 giri e 2' tra le serie. Vale dalla prossima seduta.</p>
        <label className="switch">
          <input type="checkbox" checked={form.forza20} onChange={async (e) => { const next = { ...form, forza20: e.target.checked }; setForm(next); await saveSettings({ ...settings, forza20: next.forza20 }); }} />
          <span>Forza da 20' in circuito</span>
        </label>
      </section>

      <section className="ex">
        <h2 className="t-title">Salute</h2>
        <p className="note">Un'app web non può scrivere in Salute da sola. Lo fa un Comando rapido: all'inizio della seduta compare "Aggiungi a Salute", che lo apre con la durata prevista. Carichi e ripetizioni restano qui e su GitHub.</p>
        <label className="switch">
          <input type="checkbox" checked={form.health} onChange={async (e) => { const next = { ...form, health: e.target.checked }; setForm(next); await saveSettings({ ...settings, health: next.health }); }} />
          <span>Proponi "Aggiungi a Salute" all'inizio di ogni seduta</span>
        </label>
        <p className="t-label">Da fare una volta, nell'app Comandi rapidi:</p>
        <ol className="guide-how">
          <li>Crea un comando e chiamalo esattamente <b>{HEALTH_SHORTCUT.forza}</b>.</li>
          <li>Aggiungi l'azione "Registra allenamento": tipo "Allenamento di forza tradizionale".</li>
          <li>In Durata tocca il valore, scegli "Input comando rapido" e come unità i minuti.</li>
          <li>Duplicalo, chiamalo <b>{HEALTH_SHORTCUT.emom}</b> e cambia il tipo in "Allenamento a intervalli ad alta intensità".</li>
        </ol>
      </section>

      <section className="ex">
        <h2 className="t-title">Recupero</h2>
        <p className="note">Valori di partenza. Dentro la seduta puoi cambiarli esercizio per esercizio toccando "recupero".</p>
        <div className="pair">
          <NumField value={form.restForza} unit="forza, secondi" label="Recupero forza in secondi" onChange={(v) => setForm({ ...form, restForza: v ?? 0 })} />
          <NumField value={form.restWarmup} unit="fine giro, secondi" label="Recupero a fine giro in secondi" onChange={(v) => setForm({ ...form, restWarmup: v ?? 0 })} />
        </div>
        <button className="btn wide" type="button" disabled={!dirty} onClick={async () => { await saveSettings(form); setMsg('Impostazioni salvate.'); }}>Salva</button>
      </section>
    </div>
  );
}
