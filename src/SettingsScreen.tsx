import { useState } from 'react';
import { flush, testConnection, useSync } from './sync';
import type { Settings } from './types';
import { NumField } from './ui';

export function SettingsScreen({ settings, saveSettings }: { settings: Settings; saveSettings: (s: Settings) => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const sync = useSync();
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const text = (k: 'owner' | 'repo' | 'token') => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="screen with-nav">
      <div className="top" />
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
