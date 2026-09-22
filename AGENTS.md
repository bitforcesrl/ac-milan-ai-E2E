# E2E Testing Instructions - Shopify E-commerce Jersey Personalizer (React)

## Obiettivo

Eseguire test end-to-end manuali (via browser MCP) su un e-commerce Shopify con personalizzatore di maglia implementato in React. Il focus è sugli aspetti **frontend UI e UX** del personalizzatore e del flusso di acquisto.

## Cosa NON fare

- NON scrivere test Playwright automatizzati (_.spec.ts, _.spec.js, test/_.js, test/_.ts)
- NON usare codegen
- NON creare file di test automatizzati
- NON modificare codice sorgente
- NON testare backend, API, o logica server-side
- NON scrivere NESSUN file di report Markdown (.md): l'unica reportistica è il JSON strutturato (vedi "Output Richiesto")

## Cosa fare

- Usare il browser MCP come un utente reale
- Testare tutti i flussi di personalizzazione disponibili
- Documentare bug e problemi UX/UI con screenshot
- Leggere i prezzi e i costi **dinamicamente dalla pagina** (non usare valori hardcoded)
- Verificare la coerenza tra ciò che l'utente seleziona e ciò che finisce nel carrello
- **Mantenere sempre la sezione testata nel viewport**: prima di interagire con un elemento o verificare un comportamento, assicurarsi che la sezione rilevante sia visibile nell'area visualizzata del browser (scrollare se necessario). Questo permette all'operatore umano di monitorare visivamente ciò che sta accadendo durante il test.

---

## Contesto Tecnico

- **Piattaforma:** Shopify
- **Personalizzatore:** Componente React embedded nella Product Detail Page (PDP)
- **Flussi disponibili:** PDP (Product Detail Page) e Quick-Buy (se presente)
- **Lingua store:** Italiano (default)
- **Reportistica:** JSON strutturato per test (`meta/<test-id>.json`), visualizzato dalla dashboard Next.js (`/reports`) che legge i report da Azure Blob Storage

---

## Step preliminari prima di iniziare il test

### Lettura della configurazione dei test

La configurazione di tutti i test disponibili è nel file `config.js` nella root del progetto. Ogni test è definito con questi campi:

- **`id`**: identificatore univoco del test (usato per derivare la variabile `E2E_TEST_*`)
- **`name`**: nome univoco e descrittivo del test
- **`file`**: percorso del file `.md` del test, relativo alla cartella `tests/`
- **`url`**: URL completo della pagina da testare
- **`enabled`**: se `true` il test viene eseguito quando non sono presenti flag `E2E_TEST_*`; se `false` viene skippato
- **`notes`**: note/istruzioni aggiuntive per l'esecuzione (stringa vuota se non presenti)

**Selezione dei test:**

- In CI Azure e in locale ogni test è controllato dalla variabile `E2E_TEST_<ID_NORMALIZZATO>` (vedi `.env.template`)
- Se non è presente alcun flag `E2E_TEST_*`, vengono eseguiti i test con `enabled: true`

**Campo `notes`:**

- Il campo `notes` contiene istruzioni o note aggiuntive specifiche per quel singolo test
- **DEVE essere letto come prima cosa prima di eseguire il test** a cui si riferisce
- Può contenere: indicazioni su cosa testare con priorità, configurazioni particolari da applicare, contesto aggiuntivo, o qualsiasi altra informazione rilevante per l'esecuzione
- Se il campo è vuoto (`notes: ''`), non ci sono note aggiuntive per quel test

### Gestione Viewport durante il test

- **IMPORTANTE:** Prima di ogni interazione o verifica visiva, assicurarsi che l'elemento/sezioni da testare sia **completamente visibile nel viewport**
- Usare lo scroll per portare la sezione target in vista prima di catturare screenshot o eseguire azioni
- Questo è fondamentale per permettere all'operatore umano di monitorare visivamente l'esecuzione del test in tempo reale
- Se un elemento è parzialmente visibile o fuori dal viewport, scrollare fino a renderlo completamente visibile prima di procedere

### Flusso di esecuzione

1. Determina i test da eseguire leggendo i flag `E2E_TEST_*`; se non sono presenti, leggi `config.js` ed esegui i test con `enabled: true`
2. **Ridimensiona il browser** al viewport richiesto dalla run (es. "1280x650") usando `browser_resize`
3. Per ogni test da eseguire:
   - **Leggi il campo `notes`** del test: se presente e non vuoto, leggi e applica le istruzioni contenute PRIMA di iniziare il test
   - Naviga all'`url` specificato nella definizione del test
   - Esegui il test definito nel file `tests/<file>` corrispondente

### Preparazione browser

- **Avvia il browser in modalità incognito** per isolare il test e simulare un utente reale senza cookie/cache preesistenti
- **Ridimensiona il browser** PRIMA di navigare all'URL del test:
  - Usa il viewport richiesto dalla run (es. "1280x650")
  - Usa `browser_resize` per impostare le dimensioni esatte
  - Esempio: `browser_resize({ width: 1280, height: 650 })`
- Naviga all'`url` specificato nella definizione del test
- Attendi che la pagina sia completamente caricata prima di iniziare il test
- **Chiudi banner e popup**: una volta caricata la pagina, cerca e chiudi eventuali finestre di consenso cookie, banner pubblicitari, popup di newsletter o altri overlay che potrebbero ostruire la vista della pagina. Clicca su pulsanti come "Accetta", "Rifiuta", "Chiudi", "X", o simili per rimuovere questi elementi prima di iniziare il test.
- **Overlay di upsell nel carrello**: quando un prodotto viene aggiunto al carrello e si naviga al carrello, si apre **automaticamente** un overlay per l'upsell di altri prodotti. Questo overlay **NON deve essere considerato un errore**: è un comportamento atteso. Deve essere semplicemente **chiudo con il tasto "X" situato in alto a destra** dell'overlay prima di procedere con il test. Non documentarlo come bug.

---

## Aspetti UI da Verificare indipendentemente dal test

### Layout e Rendering

- [ ] Il componente React si renderizza senza errori visibili
- [ ] Il layout è coerente con il resto della pagina Shopify
- [ ] Non ci sono elementi sovrapposti o tagliati
- [ ] Le immagini dell'anteprima sono di buona qualità
- [ ] I pulsanti di personalizzazione sono ben distinguibili (attivo vs non attivo)

### Feedback Visivo

- [ ] Hover state sui pulsanti
- [ ] Focus state visibile per accessibilità keyboard

### Tipografia e Colori

- [ ] Font leggibili e coerenti
- [ ] Contrasto sufficiente per accessibilità
- [ ] Colori coerenti con il brand
- [ ] Dimensioni testo appropriate

## Cosa Monitorare

### Errori Tecnici

- [ ] Errori console JavaScript
- [ ] Richieste HTTP con status 4xx o 5xx
- [ ] React warnings o errors
- [ ] Elementi non cliccabili che dovrebbero esserlo
- [ ] Pulsanti senza effetto
- [ ] Pagine bianche o blank states
- [ ] Loop di navigazione o re-rendering infiniti

### Problemi UX

- [ ] Prezzi non aggiornati correttamente
- [ ] Anteprime non funzionanti o non aggiornate
- [ ] Form che si resettano inaspettatamente
- [ ] Elementi aggiunti al carrello senza selezione utente
- [ ] Messaggi di errore mancanti o poco chiari
- [ ] Feedback visivo assente dopo azioni
- [ ] Stato del personalizzatore perso durante la navigazione

---

## Scelta tra Vision (Screenshot) e DOM (Snapshot)

Durante l'esecuzione dei test con Playwright MCP, devi valutare attentamente se utilizzare la **vision** (screenshot) o il **contenuto DOM** (accessibility snapshot) per le verifiche.

### Quando usare la Vision (Screenshot)

Usa `browser_take_screenshot` quando il task richiede verifiche di:

- **Coerenza visiva**: layout, allineamenti, spacing, positioning
- **Consistenza grafica**: colori, font, dimensioni elementi, hover states
- **Validità visiva**: rendering corretto di immagini, anteprime, overlay
- **Problemi di sovrapposizione**: elementi che si coprono o si tagliano
- **Qualità delle immagini**: anteprime sfocate, pixelate, o distorte
- **Feedback visivo**: animazioni, transizioni, stati attivi/inattivi dei pulsanti
- **Errori di rendering**: testi troncati, caratteri speciali errati, formattazione inconsistente

**Esempi pratici:**

- Verificare che l'anteprima della maglia personalizzata si aggiorni correttamente
- Controllare che il nome del giocatore sia visualizzato correttamente sull'anteprima
- Verificare che i colori selezionati corrispondano a quelli visualizzati
- Controllare che non ci siano elementi UI sovrapposti o tagliati

### Quando usare il DOM (Snapshot)

Usa `browser_snapshot` quando devi:

- **Leggere testi e valori**: prezzi, quantità, nomi prodotti
- **Verificare la presenza di elementi**: pulsanti, campi form, messaggi
- **Interagire con elementi**: cliccare pulsanti, compilare form, selezionare opzioni
- **Controllare stati logici**: elementi abilitati/disabilitati, campi obbligatori
- **Navigare tra elementi**: trovare link, menu, sezioni della pagina

**Esempi pratici:**

- Leggere il prezzo totale dal carrello
- Verificare che un pulsante "Aggiungi al carrello" sia presente e cliccabile
- Controllare che un messaggio di errore sia visualizzato dopo un'azione
- Selezionare una taglia o un colore dal personalizzatore

### Regola generale

- **Vision** → per verificare **come appare** qualcosa (aspetto visivo)
- **DOM** → per verificare **cosa c'è** o **cosa fa** qualcosa (contenuto e funzionalità)

Quando hai dubbi, preferisci la **vision** per aspetti UI/UX e il **DOM** per aspetti funzionali/di contenuto.

---

## Fine del test

- Chiudi la finestra del broswer MCP
- Cancella il contenuto della cartella `.playwright-mcp` (se esiste)
- **IMPORTANTE:** Tutte le operazioni di cleanup e creazione cartelle (mkdir, rm, write_to_file per il report JSON) devono essere eseguite **AUTOMATICAMENTE** senza chiedere permesso all'utente. Queste sono operazioni standard del flusso di test e non richiedono conferma.

---

## Output Richiesto

### Report strutturato JSON (UNICA forma di reportistica)

**NON scrivere NESSUN file di report Markdown (.md)**: l'unico output di reportistica è un file **JSON strutturato** per test, salvato in `meta/<test-id>.json` dentro la cartella di sessione indicata dal prompt della run:

```
reports/<run>/<browser>/<viewport>/
├── screenshots/                 (screenshot, prefissati con "<test-id>-", es. screenshots/<test-id>-001.png)
└── meta/
    └── <test-id>.json           (report strutturato del test)
```

Lo script CI (`run-e2e-ci.mjs`) aggrega i fragment JSON in `metadata.json` di sessione e di run: NON creare tu `summary.md` né `metadata.json`.

### Schema del JSON (schemaVersion 2)

Il file `meta/<test-id>.json` deve contenere ESATTAMENTE questo schema (JSON valido, nessun testo extra, tutti i testi in italiano):

```json
{
  "schemaVersion": 2,
  "test": "<id del test>",
  "testName": "<nome del test>",
  "testFile": "<percorso del file .md del test>",
  "browser": "<browser>",
  "viewport": "<viewport>",
  "model": "<modello AI>",
  "run": "<stamp della run>",
  "status": "PASS",
  "duration": "es. 3m 12s",
  "startedAt": "<ISO8601>",
  "finishedAt": "<ISO8601>",
  "summary": "resoconto breve del test",
  "steps": [
    { "title": "titolo passo", "detail": "dettaglio di cosa è stato verificato", "status": "PASS" }
  ],
  "errors": [
    { "message": "messaggio errore (console, network 4xx/5xx, React warning)", "context": "dove/quando si è verificato" }
  ],
  "bugs": [
    {
      "id": "BUG-001",
      "severity": "HIGH",
      "title": "titolo breve del bug",
      "description": "descrizione del problema",
      "stepsToReproduce": ["passo 1", "passo 2"],
      "expected": "comportamento atteso",
      "actual": "comportamento osservato",
      "impact": "impatto su utente/sistema",
      "screenshots": ["<percorso screenshot>"]
    }
  ],
  "screenshots": [
    { "path": "<percorso screenshot>", "description": "cosa mostra lo screenshot" }
  ],
  "hash": "<sha256 esadecimale calcolato sui campi principali>",
  "timestamp": "<ISO8601 della scrittura>"
}
```

**Regole per il JSON:**

- `steps` deve coprire tutte le fasi del test eseguite, con esito per passo (`PASS` / `FAIL` / `INFO`)
- `errors` elenca errori console/network/React osservati (array vuoto se nessuno)
- `bugs` elenca i bug trovati con severità `HIGH` / `MEDIUM` / `LOW` (array vuoto se nessuno); ogni screenshot citato in un bug DEVE esistere in `screenshots`
- `screenshots` elenca TUTTI gli screenshot salvati (solo se hai trovato bug/anomalie) con descrizione
- Il JSON è l'UNICA fonte per la dashboard dei report (app Next.js `/reports`): compila ogni campo con cura, non lasciare campi richiesti vuoti se hai i dati
- Gli screenshot vanno salvati **solo se viene trovato un bug o un'anomalia**; non salvare screenshot di pagine funzionanti

### Contenuto atteso (equivalente del vecchio report .md)

1. **Summary** — stato generale del test e scenario (taglia, personalizzazione, patch, prezzo finale)
2. **Steps** — fasi eseguite con esito
3. **Errors** — errori console, network issues, React warnings
4. **Bugs** — lista dettagliata con severità (HIGH/MEDIUM/LOW), descrizione, steps to reproduce, expected vs actual, impact, screenshot
5. **Screenshots** — elenco completo con descrizione
6. **Duration / Viewport** — tempo di esecuzione e dimensioni del browser

---

## Note

- Il test deve essere eseguito come un utente reale
- Documentare ogni anomalia, anche se sembra minore
- Verificare sempre la coerenza tra selezione e carrello
- Leggere i prezzi dinamicamente dalla pagina (non usare valori hardcoded)
- Verificare che l'anteprima si aggiorni in tempo reale
- Prestare attenzione a problemi specifici di React (state management, re-rendering, lifecycle)
- **Tracciare sempre il tempo di esecuzione** del test e includerlo nel report JSON (`duration`, `startedAt`, `finishedAt`)
- **Massima attenzione ai caratteri testuali**: durante i controlli visivi, prestare estrema attenzione a tutti i caratteri presenti nel testo e nelle immagini (errori di battitura, caratteri speciali errati, formattazione inconsistente, testo troncato o illeggibile)
- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.
- **Selezione taglie**: le taglie disponibili dipendono da come sono configurate sul prodotto. Non c'è requisito che appaiano sempre tutte abilitate o disabilitate — alcune taglie possono anche non comparire affatto. Comportamento atteso, NON va segnalato come bug.
