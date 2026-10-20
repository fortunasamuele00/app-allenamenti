import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { db } from './db';
import './styles.css';

/** Se qualcosa si rompe, al posto della schermata vuota compare cosa è successo e come uscirne. */
class Guard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen crash">
        <h1 className="t-display">L'app si è fermata</h1>
        <p className="note">Errore: {this.state.error.message}</p>
        <button className="btn ink wide" type="button" onClick={() => location.reload()}>Riapri</button>
        <button className="btn wide" type="button" onClick={async () => { await db.saveDraft(null).catch(() => {}); location.hash = '#/'; location.reload(); }}>Chiudi la seduta aperta e riapri</button>
        <p className="t-label">Le sedute già salvate non vengono toccate.</p>
      </div>
    );
  }
}

registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(<StrictMode><Guard><App /></Guard></StrictMode>);
