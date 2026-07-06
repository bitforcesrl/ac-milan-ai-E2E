# PDP (Product Detail Page) QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto sulla Product Detail Page (PDP) del sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Cosa NON fare

- NON scrivere test Playwright (_.spec.ts, _.spec.js, test/_.js, test/_.ts)
- NON usare codegen
- NON creare file di test automatizzati

## Cosa fare

Usare il browser MCP come un utente reale.

---

## Workflow di Testing

### 1. Apertura PDP

- Navigare all'URL del prodotto fornito dall'utente
- Accettare i cookie se richiesto
- Attendere il caricamento completo della pagina
- Verificare che la pagina prodotto sia visualizzata correttamente

### 2. Analisi Pagina Prodotto

- Verificare presenza elementi:
  - Titolo prodotto
  - Prezzo base
  - Galleria immagini
  - Selettore taglia
  - Sezione personalizzazione
  - Pulsante "Aggiungi al carrello"
  - Descrizione prodotto

### 3. Test del Flusso PDP

Eseguire le seguenti azioni in sequenza:

#### 3.1 Selezione Taglia

- Identificare le taglie disponibili
- Selezionare una taglia (es. M, L)
- Verificare che:
  - La selezione sia evidenziata visivamente
  - L'URL si aggiorni con il parametro variant
  - Le taglie non disponibili siano disabilitate

#### 3.2 Personalizzazione - Nome e Numero

- Testare l'opzione "Giocatore" (se disponibile)
  - Cliccare sul pulsante "Giocatore"
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - Selezionare un giocatore dal dropdown
  - Verificare che il nome e numero appaiano nell'anteprima
- Testare l'opzione "Tuo Nome" (se disponibile)
  - Cliccare sul pulsante "Tuo Nome"
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - Verificare che i campi input appaiano

#### 3.3 Personalizzazione - Patch

- Selezionare una patch disponibile (es. SERIE A)
- Verificare che:
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - La patch appaia nell'anteprima
  - Il pulsante mostri stato "active"

#### 3.4 Verifica Prezzo

- Leggere il prezzo base dalla pagina
- Leggere i costi di personalizzazione e patch direttamente dai pulsanti/etichette
- Calcolare il prezzo atteso dinamicamente:
  - Prezzo base letto + costo personalizzazione letto + costo patch letto
- Verificare che il prezzo visualizzato corrisponda al calcolo
- Verificare che il totale sia mostrato correttamente
- NOTA: i prezzi possono variare, non usare valori hardcoded ma sempre quelli letti dalla pagina

#### 3.5 Verifica Anteprima

- Controllare che l'anteprima mostri:
  - Nome giocatore/nome personalizzato
  - Numero
  - Patch selezionata
- Verificare che l'anteprima si aggiorni in tempo reale

#### 3.6 Aggiunta al Carrello

- Cliccare "Aggiungi al carrello"
- Verificare che il carrello si apra/confermi l'aggiunta
- Controllare il contenuto del carrello:
  - Prodotto corretto
  - Taglia corretta
  - Personalizzazione corretta (nome, numero, patch)
  - Prezzo totale corretto
- Verificare che NON ci siano prodotti non selezionati

#### 3.7 Test Deselezione

- Deselezionare personalizzazioni già attivate
- Verificare che:
  - Il prezzo si aggiorni correttamente (diminuisca)
  - L'anteprima si aggiorni rimuovendo gli elementi deselezionati
  - I campi input si resettino se necessario

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

- [ ] Prezzi non aggiornati correttamente
- [ ] Anteprime non funzionanti
- [ ] Form che si resettano inaspettatamente
- [ ] Elementi aggiunti al carrello senza selezione utente
- [ ] Messaggi di errore mancanti o poco chiari
- [ ] Feedback visivo assente dopo azioni

---

## Checklist PDP

### Elementi Pagina

- [ ] Titolo prodotto visibile
- [ ] Prezzo base corretto
- [ ] Galleria immagini funzionante
- [ ] Selettore taglia presente
- [ ] Sezione personalizzazione visibile
- [ ] Pulsante aggiungi al carrello attivo

### Selezione Taglia

- [ ] Taglie disponibili cliccabili
- [ ] Taglie non disponibili disabilitate
- [ ] URL si aggiorna con variant
- [ ] Selezione evidenziata visivamente

### Personalizzazione Giocatore

- [ ] Pulsante "Giocatore" cliccabile
- [ ] Prezzo si aggiorna dinamicamente (leggere il costo dal pulsante)
- [ ] Dropdown giocatori funzionante
- [ ] Nome e numero appaiono in anteprima

### Personalizzazione Tuo Nome

- [ ] Pulsante "Tuo Nome" cliccabile
- [ ] Prezzo si aggiorna dinamicamente (leggere il costo dal pulsante)
- [ ] Campi input appaiono
- [ ] Validazione input funzionante

### Patch

- [ ] Pulsante patch cliccabile
- [ ] Prezzo si aggiorna dinamicamente (leggere il costo dal pulsante)
- [ ] Patch appare in anteprima
- [ ] Stato active visibile

### Prezzo e Carrello

- [ ] Prezzo totale calcolato correttamente
- [ ] Aggiunta al carrello funzionante
- [ ] Contenuto carrello corretto
- [ ] Nessun prodotto non selezionato
- [ ] Taglia corretta nel carrello
- [ ] Personalizzazione corretta nel carrello

### Feedback

- [ ] Feedback visivo dopo aggiunta
- [ ] Messaggio conferma visibile

---

## Note

- Il test deve essere eseguito come un utente reale
- Documentare ogni anomalia, anche se sembra minore
- Verificare sempre la coerenza tra selezione e carrello
- Controllare che i prezzi siano calcolati correttamente leggendo i valori dalla pagina (non usare valori hardcoded)
- Confrontare il comportamento PDP con quickbuy se entrambi disponibili
- Verificare che l'anteprima si aggiorni in tempo reale
