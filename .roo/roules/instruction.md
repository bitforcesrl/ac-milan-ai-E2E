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

## Workflow di Testing

### 1. Apertura Pagina Prodotto

- Navigare all'URL del prodotto fornito dall'utente
- Accettare i cookie se richiesto
- Attendere il caricamento completo della pagina (incluso il componente React)
- Verificare che il personalizzatore sia renderizzato correttamente

### 2. Analisi Pagina Prodotto

Verificare la presenza e il corretto rendering di:

- [ ] Titolo prodotto
- [ ] Prezzo base (leggere il valore dalla pagina)
- [ ] Galleria immagini
- [ ] Selettore taglia
- [ ] Sezione personalizzazione (componente React)
- [ ] Pulsante "Aggiungi al carrello"
- [ ] Descrizione prodotto

### 3. Test Selezione Taglia

- Identificare le taglie disponibili
- Selezionare una taglia
- Verificare che:
  - [ ] La selezione sia evidenziata visivamente
  - [ ] L'URL si aggiorni con il parametro `variant`
  - [ ] Le taglie non disponibili siano disabilitate/visivamente distinte
  - [ ] Il click sulla taglia abbia feedback visivo immediato

### 4. Test Personalizzazione - Nome e Numero

#### 4.1 Opzione "Giocatore" (se disponibile)

- Cliccare sul pulsante "Giocatore"
- Leggere il costo dal pulsante (es. "+ €X")
- Verificare che il prezzo si aggiorni dinamicamente dell'importo indicato
- Selezionare un giocatore dal dropdown
- Verificare che nome e numero appaiano nell'anteprima

#### 4.2 Opzione "Tuo Nome" (se disponibile)

- Cliccare sul pulsante "Tuo Nome"
- Leggere il costo dal pulsante (es. "+ €X")
- Verificare che il prezzo si aggiorni dinamicamente dell'importo indicato
- Verificare che i campi input appaiano
- Testare la validazione:
  - [ ] Limite caratteri nome (verificare counter)
  - [ ] Limite caratteri numero (verificare counter)
  - [ ] Input vuoti
  - [ ] Caratteri speciali (se accettati o bloccati)

### 5. Test Personalizzazione - Patch

- Selezionare una patch disponibile
- Leggere il costo dal pulsante (es. "+ €X")
- Verificare che:
  - [ ] Il prezzo si aggiorni dinamicamente dell'importo indicato
  - [ ] La patch appaia nell'anteprima
  - [ ] Il pulsante mostri stato "active"/selezionato

### 6. Verifica Prezzo Dinamica

- Leggere il prezzo base dalla pagina
- Leggere i costi di personalizzazione e patch direttamente dai pulsanti/etichette
- Calcolare il prezzo atteso: **Prezzo base letto + costo personalizzazione letto + costo patch letto**
- Verificare che il prezzo visualizzato corrisponda al calcolo
- **NOTA:** i prezzi possono variare, NON usare valori hardcoded ma sempre quelli letti dalla pagina

### 7. Verifica Anteprima

- Controllare che l'anteprima mostri:
  - [ ] Nome giocatore/nome personalizzato
  - [ ] Numero
  - [ ] Patch selezionata
- Verificare che l'anteprima si aggiorni in tempo reale ad ogni modifica
- Verificare la qualità visiva dell'anteprima (font, colori, posizionamento)

### 8. Test Deselezione

- Deselezionare personalizzazioni già attivate
- Verificare che:
  - [ ] Il prezzo si aggiorni correttamente (diminuisca)
  - [ ] L'anteprima si aggiorni rimuovendo gli elementi deselezionati
  - [ ] I campi input si resettino se necessario

### 9. Aggiunta al Carrello

- Cliccare "Aggiungi al carrello"
- Verificare che:
  - [ ] Il carrello si apra/confermi l'aggiunta
  - [ ] Il prodotto sia corretto
  - [ ] La taglia sia corretta
  - [ ] La personalizzazione sia corretta (nome, numero, patch)
  - [ ] Il prezzo totale sia corretto

### 10. Test Cambio Configurazione

- Dopo aver aggiunto al carrello, modificare la personalizzazione
- Aggiungere nuovamente al carrello con configurazione diversa
- Verificare che il carrello contenga entrambe le configurazioni distinte

---

## Aspetti UI da Verificare

### Layout e Rendering

- [ ] Il componente React si renderizza senza errori visibili
- [ ] Il layout è coerente con il resto della pagina Shopify
- [ ] Non ci sono elementi sovrapposti o tagliati
- [ ] Le immagini dell'anteprima sono di buona qualità
- [ ] I pulsanti di personalizzazione sono ben distinguibili (attivo vs non attivo)

### Responsive Design

- [ ] Testare con viewport desktop (1280px+)
- [ ] Testare con viewport tablet (768px)
- [ ] Testare con viewport mobile (375px)
- [ ] Verificare che il personalizzatore sia usabile su mobile
- [ ] Verificare che l'anteprima sia visibile su mobile

### Feedback Visivo

- [ ] Hover state sui pulsanti
- [ ] Active/selected state sulle opzioni di personalizzazione
- [ ] Loading state durante aggiornamenti prezzo
- [ ] Transizioni smooth tra stati
- [ ] Focus state visibile per accessibilità keyboard

### Tipografia e Colori

- [ ] Font leggibili e coerenti
- [ ] Contrasto sufficiente per accessibilità
- [ ] Colori coerenti con il brand
- [ ] Dimensioni testo appropriate

---

## Aspetti UX da Verificare

### Flusso Utente

- [ ] Il flusso di personalizzazione è intuitivo
- [ ] L'ordine delle azioni è logico (taglia → personalizzazione → carrello)
- [ ] L'utente capisce cosa sta personalizzando
- [ ] Il prezzo è sempre visibile durante la personalizzazione

### Gestione Errori

- [ ] Messaggi di errore chiari quando la validazione fallisce
- [ ] Impossibile aggiungere al carrello senza taglia selezionata
- [ ] Impossibile aggiungere al carrello con personalizzazione incompleta
- [ ] Feedback chiaro quando un'opzione non è disponibile

### Performance Percepita

- [ ] Il componente React carica rapidamente
- [ ] Gli aggiornamenti del prezzo sono istantanei
- [ ] L'anteprima si aggiorna senza lag
- [ ] Nessun flickering o re-rendering eccessivo

### Accessibilità

- [ ] Navigazione da tastiera funzionante
- [ ] ARIA labels presenti su elementi interattivi
- [ ] Focus indicator visibile
- [ ] Screen reader compatibility (verificare struttura semantica)

---

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

## Output Richiesto

Generare un file `PDP_QA_REPORT.md` contenente:

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
- Testare entrambi i flussi (PDP e quickbuy) se disponibili
- Verificare che l'anteprima si aggiorni in tempo reale
- Prestare attenzione a problemi specifici di React (state management, re-rendering, lifecycle)
- Verificare la comunicazione tra componente React e Shopify cart API
- Testare edge cases: deselezione, cambio configurazione, input invalidi
- **Tracciare sempre il tempo di esecuzione** del test e includerlo nel report finale
