# E2E Testing Instructions - Shopify E-commerce Jersey Personalizer (React)

> Questo file contiene le istruzioni per l'esecuzione dei test E2E manuali (via browser MCP).
> Per lo sviluppo dell'app Next.js (dashboard report), vedi `AGENTS.md`.

## Obiettivo

Eseguire test end-to-end manuali (via browser MCP) su un e-commerce Shopify con personalizzatore di maglia implementato in React. Il focus è sugli aspetti **frontend UI e UX** del personalizzatore e del flusso di acquisto.

## Cosa NON fare

- NON scrivere test Playwright automatizzati (_.spec.ts, _.spec.js, test/_.js, test/_.ts)
- NON usare codegen
- NON creare file di test automatizzati
- NON modificare codice sorgente
- NON testare backend, API, o logica server-side
- Il report di test è un file Markdown (vedi "Output Richiesto"): i metadati JSON (in CI `metadata/<test-id>.json` temporaneo per-test, più `index.json`) vanno invece generati direttamente come JSON strutturato, MAI parsando il Markdown

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
- **Reportistica:** report Markdown per test (`tests/<test-id>.md`), visualizzato dalla dashboard Next.js (`/reports`) che legge i report da Azure Blob Storage

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
- **Genera i metadati JSON** (vedi "Metadati JSON generati dall'AI"): metadata di sessione, di run e aggiornamento di `reports/index.json`
- Cancella il contenuto della cartella `.playwright-mcp` (se esiste)
- **IMPORTANTE:** Tutte le operazioni di cleanup e creazione cartelle (mkdir, rm, write_to_file per il report) devono essere eseguite **AUTOMATICAMENTE** senza chiedere permesso all'utente. Queste sono operazioni standard del flusso di test e non richiedono conferma.

---

## Output Richiesto

### Report Markdown (UNICA forma di reportistica del test)

**NON scrivere NESSUN file JSON di report del test**: l'unico output di reportistica del test è un file **Markdown** per test, salvato in `tests/<test-id>.md` dentro la cartella di sessione indicata dal prompt della run:

```
reports/<run>/<browser>/<viewport>/
├── screenshots/                 (screenshot, prefissati con "<test-id>-", es. screenshots/<test-id>-001.png)
├── metadata/
│   └── <test-id>.json           (in CI: metadati JSON TEMPORANEI del test, aggregati e cancellati dallo script)
└── tests/
    └── <test-id>.md             (report Markdown del test)
```

Il report Markdown è l'UNICO file `.md` che generi. I metadati JSON (in CI il file temporaneo per-test `metadata/<test-id>.json`, vedi sotto) vanno invece generati direttamente da te: NESSUN script deve parsare il Markdown. NON creare `summary.md`.

### Struttura delle cartelle

- **Nome file:** `<test-id>.md` (l'id del test come definito in `config.js`)
- **REGOLA STRETTA SUGLI SCREENSHOT:** gli screenshot vanno salvati nella cartella `screenshots/` **ESCLUSIVAMENTE per documentare bug o anomalie trovate**. Per ogni bug possono essere salvati **uno o più screenshot** (quelli necessari a mostrare il problema: es. lo stato che causa il bug e il risultato errato). È **VIETATO** salvare screenshot "di documentazione", "di stato iniziale", "di contesto" o di pagine/flussi che funzionano correttamente. Se il test è PASS e non hai trovato bug da documentare, la cartella `screenshots/` deve restare VUOTA (o non essere creata). Ogni screenshot salvato deve corrispondere a un bug citato nel report.
- **COME salvare uno screenshot (procedura obbligatoria quando trovi un bug):**
  1. Crea la cartella `screenshots/` se non esiste.
  2. Chiama `browser_take_screenshot` passando il parametro `filename` con il **percorso assoluto** del file (es. `reports/<run>/<browser>/<viewport>/screenshots/<test-id>-001.png`). **Senza `filename` l'immagine NON viene salvata su disco** e il bug resta senza evidenza: il fatto che lo screenshot appaia nella risposta del tool non significa che sia stato persistito.
  3. Verifica che il file esista su disco (tool filesystem/shell); se non esiste, riprova.
  4. Linkalo inline nel report Markdown con percorso relativo e aggiungi il percorso in `screenshotPaths` nei metadati.
- **CHECK FINALE (obbligatorio prima di dichiarare il test completato):** ogni bug nel report ha almeno uno screenshot salvato su disco e linkato inline; `screenshotPaths` elenca TUTTI i file effettivamente presenti in `screenshots/`. Se hai dichiarato bug ma `screenshots/` è vuota, NON procedere: salva gli screenshot mancanti prima di continuare.
- **Gli screenshot devono essere sempre linkati nel report** usando la sintassi markdown per le immagini, con percorso relativo: `![descrizione](../screenshots/<test-id>-001.png)`. Inserire gli screenshot inline nel report in corrispondenza della fase o del bug a cui si riferiscono, in modo che siano immediatamente visibili durante la lettura.

### Contenuto del Report

Tutti i report devono essere scritti in lingua italiana. Sei libero di organizzare il report come preferisci (tabelle, griglie, sezioni, ecc.), ma deve contenere almeno:

1. **Executive Summary** - Stato generale del test (includi l'esito: PASS/FAIL)
2. **Test Scenario** - Configurazione utilizzata (taglia, personalizzazione, patch, prezzo finale)
3. **Bugs Found** - Lista dettagliata dei bug con:
   - Severità (HIGH/MEDIUM/LOW)
   - Descrizione
   - Steps to reproduce
   - Expected vs Actual
   - Impact
   - Screenshot (se disponibile, inline nel punto giusto)
4. **Technical Observations** - Errori console, network issues, React warnings
5. **UX Issues** - Problemi di usabilità con suggerimenti
6. **Recommendations** - Suggerimenti per fix prioritizzati
7. **Execution Time** - Tempo totale impiegato per eseguire il test (dall'inizio alla fine)
8. **Viewport** - Dimensioni della finestra del browser utilizzate durante il test (larghezza x altezza in pixel)

### Metadati JSON generati dall'AI (OBBLIGATORIO a fine test)

I metadati JSON **vanno generati direttamente da te** (NESSUN parsing del Markdown da parte di script): sono la fonte strutturata per la dashboard Next.js (`/reports`). In CI lo script `run-e2e-ci.mjs` li usa per l'aggregazione; in esecuzione manuale li scrivi tu. Alla fine del test scrivi:

**1. Metadata di sessione** — `<cartella-sessione>/metadata.json`:

```json
{
  "browser": "chromium",
  "viewport": "1280x650",
  "model": "<modello AI o 'manual'>",
  "run": "<stamp della run>",
  "date": "<data UTC ISO, es. 2026-09-29T10-14-00 → 2026-09-29T10:14:00Z>",
  "duration": "es. 3m 12s",
  "status": "PASS | FAIL",
  "summary": "resoconto breve del test",
  "tests": [
    { "id": "<test-id>", "name": "<nome test>", "status": "PASS | FAIL", "report": "<percorso del file .md>" }
  ],
  "bugs": { "high": 0, "medium": 0, "low": 0 },
  "reportPaths": ["<percorso del file .md>"],
  "screenshotPaths": ["<percorso di ogni screenshot salvato>"]
}
```

**2. Metadata di run** — `reports/<run>/metadata.json` (se non esiste già):

```json
{
  "run": "<stamp della run>",
  "date": "<data UTC ISO>",
  "status": "PASS | FAIL",
  "sessions": [ { "browser": "chromium", "viewports": ["1280x650"] } ]
}
```

**3. Index delle run** — `reports/index.json`: array di record (uno per run, più recente prima). Leggi il file esistente, aggiorna/aggiungi in testa il record della run corrente (stesso `run` = update, mai duplicati):

```json
[
  {
    "run": "<stamp della run>",
    "date": "<data UTC ISO>",
    "status": "PASS | FAIL",
    "pass": 1, "fail": 0, "total": 1,
    "passRate": 100,
    "bugs": { "high": 0, "medium": 0, "low": 0 },
    "duration": "es. 3m 12s",
    "environments": [ { "browser": "chromium", "viewport": "1280x650" } ]
  }
]
```

Regole:
- `status` deve riflettere l'esito REALE del test (FAIL se la condizione del test non è soddisfatta o se c'è almeno un bug HIGH)
- `bugs` contiene i conteggi REALI dei bug per severità trovati nel test (0 se nessuno)
- `screenshotPaths` elenca TUTTI gli screenshot salvati (vuoto se nessuno)
- Tutte le operazioni di lettura/scrittura di questi JSON sono automatiche, senza chiedere conferma

### Template Bug Report

```markdown
### 🔴/🟡/🟢 BUG-XXX: [Titolo]

**Severity:** HIGH/MEDIUM/LOW
**Location:** [Dove si verifica - PDP, cart, preview, etc.]
**Description:** [Descrizione del problema]

**Steps to Reproduce:**

1. ...
2. ...
3. ...

**Expected:** [Comportamento atteso]
**Actual:** [Comportamento osservato]
**Impact:** [Impatto sull'utente/sistema]
**Screenshot:** [screenshot inline se disponibile]
```

---

## Note

- Il test deve essere eseguito come un utente reale
- Documentare ogni anomalia, anche se sembra minore
- Verificare sempre la coerenza tra selezione e carrello
- Leggere i prezzi dinamicamente dalla pagina (non usare valori hardcoded)
- Verificare che l'anteprima si aggiorni in tempo reale
- Prestare attenzione a problemi specifici di React (state management, re-rendering, lifecycle)
- **Tracciare sempre il tempo di esecuzione** del test e includerlo nel report Markdown (sezione Execution Time)
- **Massima attenzione ai caratteri testuali**: durante i controlli visivi, prestare estrema attenzione a tutti i caratteri presenti nel testo e nelle immagini (errori di battitura, caratteri speciali errati, formattazione inconsistente, testo troncato o illeggibile)
- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.
- **Selezione taglie**: le taglie disponibili dipendono da come sono configurate sul prodotto. Non c'è requisito che appaiano sempre tutte abilitate o disabilitate — alcune taglie possono anche non comparire affatto. Comportamento atteso, NON va segnalato come bug.
