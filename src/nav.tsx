import { useEffect, useState, type AnchorHTMLAttributes } from 'react';

/**
 * Cambio schermata senza navigazione del browser: l'indirizzo si aggiorna con pushState
 * e React ridisegna. Così il passaggio tra le schede non mostra pagine intermedie.
 */
export function go(to: string) {
  if ((location.hash || '#/') === to) return;
  history.pushState(null, '', to);
  window.dispatchEvent(new Event('route'));
}

export function useRoute(): string {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => { setHash(location.hash || '#/'); window.scrollTo(0, 0); };
    for (const ev of ['route', 'popstate', 'hashchange']) window.addEventListener(ev, on);
    return () => { for (const ev of ['route', 'popstate', 'hashchange']) window.removeEventListener(ev, on); };
  }, []);
  return hash;
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={to} onClick={(e) => { e.preventDefault(); go(to); }} {...rest} />;
}
