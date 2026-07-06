# Quick Buy QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto rapido (quick-buy) sul sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Cosa NON fare

- NON scrivere test Playwright (_.spec.ts, _.spec.js, test/_.js, test/_.ts)
- NON usare codegen
- NON creare file di test automatizzati

## Cosa fare

Usare il browser MCP come un utente reale.

---

## Workflow di Testing

### 1. Apertura Sito

- Navigare all'URL fornito dall'utente
- Accettare i cookie se richiesto
- Attendere il caricamento completo della pagina

### 2. Individuazione Sezione Quick-Buy

- Cercare la sezione `.quick-buy` nella pagina
- Se non trovata sulla homepage, cercare nelle pagine prodotto
- Scorrere fino alla sezione e analizzarne la struttura

### 3. Test del Flusso Quick-Buy

Eseguire le seguenti azioni in sequenza:

#### 3.1 Selezione Prodotto

- Identificare il prodotto disponibile per la personalizzazione
- Verificare che il prezzo base sia visualizzato correttamente

#### 3.2 Selezione Taglia

- Selezionare una taglia disponibile (es. M, L)
- Verificare che la selezione sia evidenziata visivamente
- Verificare che taglie non disponibili siano disabilitate

#### 3.3 Personalizzazione - Nome e Numero

- Testare l'opzione "Giocatore" (se disponibile)
  - Selezionare un giocatore dal dropdown
  - Verificare che il nome e numero appaiano nell'anteprima
- Testare l'opzione "Tuo Nome" (se disponibile)
  - Inserire un nome personalizzato
  - Verificare che appaia nell'anteprima

#### 3.4 Personalizzazione - Patch

- Selezionare una patch disponibile (es. SERIE A)
- Verificare che la patch appaia nell'anteprima

#### 3.5 Verifica Prezzo

- Calcolare il prezzo atteso:
  - Prezzo base + costo personalizzazione + costo patch
- Verificare che il prezzo visualizzato corrisponda al calcolo

#### 3.6 Aggiunta al Carrello

- Cliccare "Aggiungi al carrello"
- Verificare che il carrello si apra/confermi l'aggiunta
- Controllare il contenuto del carrello:
  - Prodotto corretto
  - Taglia corretta
  - Personalizzazione corretta (nome, numero, patch)
  - Prezzo totale corretto

---

## Cosa Monitorare

Durante tutta la navigazione, registrare:

### Errori Tecnici

- [ ] Errori console (JavaScript errors)
- [ ] Richieste HTTP con status 4xx o 5xx
- [ ] JS exceptions
- [ ] Elementi non cliccabili che dovrebbero esserlo
- [ ] Pulsanti senza effetto
- [ ] Pagine bianche
- [ ] Loop di navigazione

### Problemi UX

- [ ] Form che si resettano inaspettatamente
- [ ] Elementi aggiunti al carrello senza selezione utente
- [ ] Prezzi non aggiornati correttamente
- [ ] Anteprime non funzionanti
- [ ] Messaggi di errore mancanti o poco chiari
- [ ] Feedback visivo assente dopo azioni

---

## Output Richiesto

Generare un file `QA_REPORT.md` contenente:

1. **Executive Summary** - Stato generale del test
2. **Test Scenario** - Configurazione utilizzata
3. **Bugs Found** - Lista dettagliata dei bug con:
   - Severità (HIGH/MEDIUM/LOW)
   - Descrizione
   - Steps to reproduce
   - Impact
4. **What Worked** - Cosa ha funzionato correttamente
5. **Technical Observations** - Errori console, network issues
6. **UX Issues** - Problemi di usabilità
7. **Recommendations** - Suggerimenti per fix

---

## Template Bug Report

```markdown
### 🔴/🟡/🟢 BUG-XXX: [Titolo]

**Severity:** HIGH/MEDIUM/LOW  
**Location:** [Dove si verifica]  
**Description:** [Descrizione del problema]

**Steps to Reproduce:**

1. ...
2. ...
3. ...

**Expected:** [Comportamento atteso]  
**Actual:** [Comportamento osservato]  
**Impact:** [Impatto sull'utente/sistema]
```

---

## Note

- Il test deve essere eseguito come un utente reale
- Documentare ogni anomalia, anche se sembra minore
- Verificare sempre la coerenza tra selezione e carrello
- Controllare che i prezzi siano calcolati correttamente
- Se la sezione `.quick-buy` non esiste, segnalarlo come finding
