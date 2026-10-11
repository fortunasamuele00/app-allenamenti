import { useState } from 'react';
import { flush, testConnection, useSync } from './sync';
import type { Settings } from './types';
import { HEALTH_SHORTCUT } from './program';
import { ThemeToggle } from './theme';
import { NumField } from './ui';

export function SettingsScreen({ settings, saveSettings }: { settings: Settings; saveSettings: (s: Settings) => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const sync = useSync();
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const text = (k: 'owner' | 'repo' | 'token') => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="screen with-nav">
      <div className="top"><span /><ThemeToggle /></div>
      <h1 className="t-display day">Impostazioni</h1>

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
      </section>

      <section className="ex">
        <h2 className="t-title">Salute</h2>
        <p className="note">Un'app web non può scrivere in Salute da sola. Lo fa un Comando rapido: a seduta salvata compare "Aggiungi a Salute", che lo apre con la durata. Carichi e ripetizioni restano qui e su GitHub.</p>
        <label className="switch">
          <input type="checkbox" checked={form.health} onChange={async (e) => { const next = { ...form, health: e.target.checked }; setForm(next); await saveSettings({ ...settings, health: next.health }); }} />
          <span>Proponi "Aggiungi a Salute" dopo ogni seduta</span>
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
