# app-allenamenti

PWA per pianificare e registrare gli allenamenti del mesociclo attivo. Vite + React + TypeScript, `vite-plugin-pwa`, IndexedDB tramite `idb`. Nessun backend.

Questo repo contiene solo codice. Le sedute vivono sul telefono (IndexedDB) e in un repo privato separato, `allenamenti-data`, dove l'app le scrive come file JSON tramite la Contents API di GitHub. Lo schema dei dati è in [`src/data-readme.md`](src/data-readme.md): l'app lo pubblica come README del repo dati.

## Comandi

```bash
npm install
npm run dev      # http://localhost:3304
npm run build    # controllo dei tipi + build statica in dist/
```

## Dove sta cosa

| File | Contenuto |
|---|---|
| `src/program.json` | Il programma attivo, convertito a mano dal file del coach. |
| `src/muscles.json` | Gruppi muscolari per esercizio, per il grafico a ragnatela. Non viene dal coach. |
| `src/guide.json` | Indicazioni generali di esecuzione. Non vengono dal coach. |
| `src/sync.ts` | Coda offline e commit sul repo dati. Il token resta in IndexedDB sul telefono. |
| `design/` | Le pagine statiche del design system e delle homepage. |

## Pubblicazione

Ogni push su `main` fa la build e la pubblica su GitHub Pages (`.github/workflows/pages.yml`).
