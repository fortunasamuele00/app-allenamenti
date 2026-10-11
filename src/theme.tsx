import { useState } from 'react';
import { Icon } from './ui';

type Theme = 'light' | 'dark';
const BG: Record<Theme, string> = { light: '#ECEDF0', dark: '#111214' };

function current(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === 'light' || forced === 'dark') return forced;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** La stessa logica gira in index.html prima del primo disegno, per non far lampeggiare il tema sbagliato. */
function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', BG[t]));
  try { localStorage.setItem('tema', t); } catch { /* resta valido fino alla chiusura */ }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="theme" type="button" aria-label={next === 'dark' ? 'Passa al tema scuro' : 'Passa al tema chiaro'} onClick={() => { apply(next); setTheme(next); }}>
      <Icon name={next === 'dark' ? 'moon' : 'sun'} />
    </button>
  );
}
