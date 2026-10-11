# allenamenti-data

Dati di allenamento di Samuele, scritti dall'app `app-allenamenti` (PWA) tramite la Contents API di GitHub. Questo README lo scrive l'app stessa: se lo schema cambia, cambia qui.

Chi legge questo repo (di solito un'altra istanza di Claude) trova qui tutto quello che serve per seguire la progressione senza aprire l'app.

## File

| Percorso | Contenuto |
|---|---|
| `program.json` | Il programma attivo, convertito dal file del coach. |
| `sessions/YYYY-MM-DD_<programma>_<parte>.json` | Una seduta. `<programma>` è `A`, `B` o `C`; `<parte>` è `forza` o `emom`. |

Un file per seduta. Se la stessa seduta viene salvata due volte nello stesso giorno, il file viene sovrascritto (la storia resta nei commit).

## `sessions/*.json`

```json
{
  "date": "2026-10-12",
  "program": "A",
  "part": "forza",
  "location": "palestra",
  "startedAt": "2026-10-12T06:12:04.000Z",
  "endedAt": "2026-10-12T06:46:31.000Z",
  "exercises": [
    {
      "id": "a-squat",
      "name": "Squat",
      "variant": "palestra",
      "block": "forza",
      "type": "peso_rip",
      "target": "4x8",
      "sets": [
        { "kg": 60, "reps": 8, "done": true, "restSec": 120 }
      ]
    }
  ],
  "notes": ""
}
```

| Campo | Tipo | Significato |
|---|---|---|
| `date` | `YYYY-MM-DD` | Giorno della seduta, ora locale del telefono. |
| `program` | `"A" \| "B" \| "C"` | Programma del mesociclo. |
| `part` | `"forza" \| "emom"` | Parte 1 (warm-up + forza) o Parte 2 (EMOM, con cardio facoltativo). |
| `location` | `"palestra" \| "casa"` | Dove è stata fatta. L'EMOM è sempre `casa`. |
| `startedAt`, `endedAt` | ISO 8601 UTC | Inizio e fine. |
| `exercises[]` | array | Nell'ordine in cui compaiono nel programma. |
| `notes` | stringa | Note libere, anche vuota. |

### `exercises[]`

| Campo | Significato |
|---|---|
| `id` | Identificatore stabile dell'esercizio, lo stesso di `program.json`. Usa questo per seguire un esercizio nel tempo, non il nome. |
| `name` | Nome della variante eseguita. |
| `variant` | `"palestra"` o `"casa"`: quale delle due versioni dell'esercizio. Un esercizio di forza può essere fatto in variante casa anche in una seduta `palestra`, e viceversa. Carichi di varianti diverse non sono confrontabili. |
| `block` | `"warmup"`, `"forza"`, `"emom"` o `"cardio"`. |
| `type` | Decide quali campi hanno le serie (tabella sotto). |
| `target` | Il previsto dal coach, come testo. Forza: `"4x8"`, `"3x10-15"` (serie x ripetizioni). Warm-up ed EMOM: per giro, es. `"15"`, `"8 per gamba"`, `"30''"`. Cardio: minuti, es. `"15'"`. |
| `sets[]` | Una voce per serie. Nel warm-up e nell'EMOM una voce per giro. |

### `sets[]` per `type`

| `type` | Campi | Note |
|---|---|---|
| `peso_rip` | `kg`, `reps` | Carico in chili. |
| `elastico_rip` | `band`, `reps` | `band` è testo libero (es. `"medio"`, `"verde doppio"`). |
| `corpo_rip` | `reps` | Corpo libero. |
| `tempo` | `seconds` | Tenute isometriche (plank, hollow hold). |
| `cardio` | `minutes` | Facoltativo: compare solo se è stato fatto. |

Tutte le serie hanno anche:

- `done` (booleano): la serie è stata spuntata. **Conta solo le serie con `done: true`.** Le altre sono righe previste e non eseguite, e possono avere valori precompilati dalla seduta precedente.
- `restSec` (numero): recupero impostato dopo quella serie, in secondi. `0` vuol dire nessun recupero (dentro il giro di warm-up, nell'EMOM).

I campi numerici mancanti non sono zeri: non sono stati inseriti.

## `program.json`

Il programma attivo, nella stessa forma in cui lo usa l'app.

- `start`, `end`: date del blocco.
- `programs[]`: `A`, `B`, `C`. Ognuno ha `forza` (con `warmup` a giri e `exercises` con le due varianti `palestra` e `casa`) ed `emom` (`minutes`, `rounds`, `exercises`, `stretching`, `cardio`).
- `substitution: true` segna le sostituzioni di Samuele per mancanza di pesi, che non sono del coach.
- `notes` elenca cosa è stato lasciato fuori dalla conversione e perché.

## Regola di progressione

Dal file del coach: se nell'ultima serie di un esercizio le ripetizioni sono almeno 2 in più del previsto per due sedute di fila dello stesso programma, è il momento di salire (elastico più duro, variante più difficile o carico). L'app mostra solo un badge "Pronto a salire" e non modifica il programma.

Per ricalcolarla: prendi le ultime due sedute con lo stesso `program` e `part` in cui compare lo stesso `id` con la stessa `variant`; guarda l'ultima serie con `done: true`; confronta `reps` con il numero più alto del `target` (`"3x10-15"` → 15).
