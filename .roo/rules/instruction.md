# E2E Testing Instructions - Shopify E-commerce Jersey Personalizer (React)

## Obiettivo

Eseguire test end-to-end manuali (via browser MCP) su un e-commerce Shopify con personalizzatore di maglia implementato in React. Il focus è sugli aspetti **frontend UI e UX** del personalizzatore e del flusso di acquisto.

## Cosa NON fare

- NON scrivere test Playwright automatizzati (_.spec.ts, _.spec.js, test/_.js, test/_.ts)
- NON usare codegen
- NON creare file di test automatizzati
- NON modificare codice sorgente
- NON testare backend, API, o logica server-side

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

---

## Step preliminari prima di iniziare il test

### Lettura del file launcher

Prima di eseguire qualsiasi test, devi leggere il file `launcher.yaml` nella root del progetto. Questo file contiene la configurazione di tutti i test disponibili.

**Struttura del launcher.yaml:**

```yaml
tests:
  - name: pdp-flow.test.md # Nome del file .md del test (in tests/)
    url: https://... # URL della pagina da testare
    action: run # run | skip | only
```

**Logica delle azioni:**

- **`run`**: Esegue il test normalmente
- **`skip`**: Salta questo test (non lo esegue)
- **`only`**: Esegue **SOLO** questo test, ignorando tutti gli altri (utile per debug rapido)

### Gestione Viewport durante il test

- **IMPORTANTE:** Prima di ogni interazione o verifica visiva, assicurarsi che l'elemento/sezioni da testare sia **completamente visibile nel viewport**
- Usare lo scroll per portare la sezione target in vista prima di catturare screenshot o eseguire azioni
- Questo è fondamentale per permettere all'operatore umano di monitorare visivamente l'esecuzione del test in tempo reale
- Se un elemento è parzialmente visibile o fuori dal viewport, scrollare fino a renderlo completamente visibile prima di procedere

### Flusso di esecuzione

1. Leggi `launcher.yaml`
2. **Ridimensiona il browser** secondo `config.viewport` specificato nel launcher (es. "1280x650") usando `browser_resize`
3. Se esiste un test con `action: only`, esegui **solo** quel test
4. Altrimenti, esegui tutti i test con `action: run` (ignora quelli con `action: skip`)
5. Per ogni test da eseguire:
   - Naviga all'`url` specificato nel launcher
   - Esegui il test definito nel file `.md` corrispondente

### Preparazione browser

- **Avvia il browser in modalità incognito** per isolare il test e simulare un utente reale senza cookie/cache preesistenti
- **Ridimensiona il browser** PRIMA di navigare all'URL del test:
  - Leggi `config.viewport` dal `launcher.yaml` (es. "1280x650")
  - Usa `browser_resize` per impostare le dimensioni esatte
  - Esempio: `browser_resize({ width: 1280, height: 650 })`
- Naviga all'`url` specificato nel launcher
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
- **IMPORTANTE:** Tutte le operazioni di cleanup e creazione cartelle (mkdir, rm, write_to_file per il report) devono essere eseguite **AUTOMATICAMENTE** senza chiedere permesso all'utente. Queste sono operazioni standard del flusso di test e non richiedono conferma.

---

## Output Richiesto

### Struttura Cartelle Report

Il report e tutti gli screenshot devono essere salvati nella cartella `/reports` del progetto, organizzati come segue:

```
reports/
└── {nome-file-test}_{YYYY-MM-DD}_{HH-MM}/
    ├── {nome-file-test}_{YYYY-MM-DD}_{HH-MM}.md  (il report del test)
    ├── screenshot-001.png    (screenshot catturati durante il test)
    ├── screenshot-002.png
    └── ...
```

- **Nome cartella:** `{nome-file-test}_{data-esecuzione}_{ora-esecuzione}` (es. `pdp-flow_2026-07-07_16-30`)
- Il nome del file test è il nome del file `.md` senza estensione
- La data è nel formato `YYYY-MM-DD`
- L'ora è nel formato `HH-MM` (24h) per evitare clash tra test eseguiti nella stessa giornata
- Gli screenshot devono essere salvati all'interno di questa cartella **solo se viene trovato un bug o un'anomalia** durante il test. Non salvare screenshot di pagine che funzionano correttamente senza problemi.
- **Il file del report deve avere lo stesso nome della cartella che lo contiene** (es. `pdp-flow_2026-07-07_16-30.md`)
- **Gli screenshot devono essere sempre linkati nel report** usando la sintassi markdown per le immagini: `![descrizione](nome-file.png)`. Inserire gli screenshot inline nel report in corrispondenza della fase o del bug a cui si riferiscono, in modo che siano immediatamente visibili durante la lettura.

### Contenuto del Report

Generare un file con lo stesso nome della cartella contenente:
Tutti i report devono essere scritti in lingua italiana

1. **Executive Summary** - Stato generale del test
2. **Test Scenario** - Configurazione utilizzata (taglia, personalizzazione, patch, prezzo finale)
3. **Bugs Found** - Lista dettagliata dei bug con:
   - Severità (HIGH/MEDIUM/LOW)
   - Descrizione
   - Steps to reproduce
   - Expected vs Actual
   - Impact
   - Screenshot (se disponibile)
4. **Technical Observations** - Errori console, network issues, React warnings
5. **UX Issues** - Problemi di usabilità con suggerimenti
6. **Recommendations** - Suggerimenti per fix prioritizzati
7. **Execution Time** - Tempo totale impiegato per eseguire il test (dall'inizio alla fine)
8. **Viewport** - Dimensioni della finestra del browser utilizzate durante il test (larghezza x altezza in pixel)

---

## Template Bug Report

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
**Screenshot:** [link se disponibile]
```

---

## Note

- Il test deve essere eseguito come un utente reale
- Documentare ogni anomalia, anche se sembra minore
- Verificare sempre la coerenza tra selezione e carrello
- Leggere i prezzi dinamicamente dalla pagina (non usare valori hardcoded)
- Verificare che l'anteprima si aggiorni in tempo reale
- Prestare attenzione a problemi specifici di React (state management, re-rendering, lifecycle)
- **Tracciare sempre il tempo di esecuzione** del test e includerlo nel report finale
- **Massima attenzione ai caratteri testuali**: durante i controlli visivi, prestare estrema attenzione a tutti i caratteri presenti nel testo e nelle immagini (errori di battitura, caratteri speciali errati, formattazione inconsistente, testo troncato o illeggibile)
- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.
- **Selezione taglie**: le taglie disponibili dipendono da come sono configurate sul prodotto. Non c'è requisito che appaiano sempre tutte abilitate o disabilitate — alcune taglie possono anche non comparire affatto. Comportamento atteso, NON va segnalato come bug.
