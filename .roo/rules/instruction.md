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
    viewport: desktop # desktop | tablet-portrait | tablet-landscape | mobile
    url: https://... # URL della pagina da testare
    action: run # run | skip | only
```

**Logica delle azioni:**

- **`run`**: Esegue il test normalmente
- **`skip`**: Salta questo test (non lo esegue)
- **`only`**: Esegue **SOLO** questo test, ignorando tutti gli altri (utile per debug rapido)

### Dimensioni Viewport

Quando imposti il viewport del browser, usa queste dimensioni di default:

| Viewport             | Larghezza | Altezza | Utilizzo                                                    |
| -------------------- | --------- | ------- | ----------------------------------------------------------- |
| **desktop**          | 1920px    | 1080px  | Test su schermo desktop standard                            |
| **tablet-portrait**  | 768px     | 1024px  | Test su tablet in orientamento verticale (iPad portrait)    |
| **tablet-landscape** | 1024px    | 768px   | Test su tablet in orientamento orizzontale (iPad landscape) |
| **mobile**           | 375px     | 667px   | Test su mobile (iPhone standard)                            |

### Flusso di esecuzione

1. Leggi `launcher.yaml`
2. Se esiste un test con `action: only`, esegui **solo** quel test
3. Altrimenti, esegui tutti i test con `action: run` (ignora quelli con `action: skip`)
4. Per ogni test da eseguire:
   - Imposta il viewport del browser secondo le dimensioni sopra
   - Naviga all'`url` specificato nel launcher
   - Esegui il test definito nel file `.md` corrispondente

### Preparazione browser

- **Avvia Chrome in modalità incognito** per isolare il test e simulare un utente reale senza cookie/cache preesistenti
- **IMPORTANTE:** Imposta il viewport del browser **PRIMA** di navigare alla pagina, usando le dimensioni specificate nel launcher. Questo garantisce che il sito si carichi già con le dimensioni corrette e appaia centrato.
- Dopo aver impostato il viewport, naviga all'`url` specificato nel launcher
- Attendi che la pagina sia completamente caricata prima di iniziare il test

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

## Fine del test

- Chiudi la finestra di chrome MCP
- Cancella il contenuto della cartella `.playwright-mcp` (se esiste)
- **IMPORTANTE:** Tutte le operazioni di cleanup e creazione cartelle (mkdir, rm, write_to_file per il report) devono essere eseguite **AUTOMATICAMENTE** senza chiedere permesso all'utente. Queste sono operazioni standard del flusso di test e non richiedono conferma.

---

## Output Richiesto

### Struttura Cartelle Report

Il report e tutti gli screenshot devono essere salvati nella cartella `/reports` del progetto, organizzati come segue:

```
reports/
└── {nome-file-test}_{YYYY-MM-DD}_{HH-MM}/
    ├── QA_REPORT.md          (il report del test)
    ├── screenshot-001.png    (screenshot catturati durante il test)
    ├── screenshot-002.png
    └── ...
```

- **Nome cartella:** `{nome-file-test}_{data-esecuzione}_{ora-esecuzione}` (es. `pdp-flow_2026-07-07_16-30`)
- Il nome del file test è il nome del file `.md` senza estensione
- La data è nel formato `YYYY-MM-DD`
- L'ora è nel formato `HH-MM` (24h) per evitare clash tra test eseguiti nella stessa giornata
- Gli screenshot devono essere salvati all'interno di questa cartella **solo se viene trovato un bug o un'anomalia** durante il test. Non salvare screenshot di pagine che funzionano correttamente senza problemi.
- Il file del report deve chiamarsi `QA_REPORT.md`

### Contenuto del Report

Generare un file `QA_REPORT.md` contenente:

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
