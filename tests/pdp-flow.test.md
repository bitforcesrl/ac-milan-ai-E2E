# PDP (Product Detail Page) QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto sulla Product Detail Page (PDP) del sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Workflow di Testing

### 1. Apertura PDP

- Verificare che la pagina prodotto sia visualizzata correttamente
- Accettare i cookie se richiesto
- Attendere il caricamento completo della pagina (incluso il componente React)
- Verificare che il personalizzatore sia renderizzato correttamente

### 2. Analisi Pagina Prodotto

- Verificare presenza elementi:
  - Titolo prodotto
  - Prezzo base
  - Galleria immagini
  - Selettore taglia
  - Sezione personalizzazione
  - Pulsante "Aggiungi al carrello"
  - Descrizione prodotto
- Verificare che il componente React si renderizzi senza errori visibili
- Verificare che il layout sia coerente con il resto della pagina Shopify
- Verificare che non ci siano elementi sovrapposti o tagliati

### 3. Test del Flusso PDP

Eseguire le seguenti azioni in sequenza:

#### 3.1 Selezione Taglia

- Identificare le taglie disponibili
- Selezionare una taglia (es. M, L)
- Verificare che:
  - La selezione sia evidenziata visivamente
  - L'URL si aggiorni con il parametro variant
  - Le taglie non disponibili siano disabilitate
  - Il click sulla taglia abbia feedback visivo immediato

#### 3.2 Personalizzazione - Nome e Numero

##### 3.2.1 Opzione "Giocatore" (se disponibile)

- Cliccare sul pulsante "Giocatore"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Selezionare un giocatore dal dropdown
- Verificare che il nome e numero appaiano nell'anteprima
- Verificare che il dropdown contenga la lista completa dei giocatori

##### 3.2.2 Opzione "Tuo Nome" (se disponibile)

- Cliccare sul pulsante "Tuo Nome"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Verificare che i campi input appaiano

##### 3.2.3 Validazione Campi Input

- Testare il limite caratteri nome (verificare counter, es. 0/10)
- Testare il limite caratteri numero (verificare counter, es. 0/2)
- Testare input vuoti (verificare comportamento)
- Testare caratteri speciali (verificare se accettati o bloccati)
- Verificare che il counter si aggiorni dinamicamente durante la digitazione
- Verificare che il nome e numero appaiano nell'anteprima in tempo reale

#### 3.3 Personalizzazione - Patch

- Selezionare una patch disponibile (es. SERIE A)
- Verificare che:
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - La patch appaia nell'anteprima
  - Il pulsante mostri che la patch è attiva (stato active)

#### 3.4 Verifica Prezzo

- Leggere il prezzo base mostrato al caricamento della PDP
- Leggere i costi di personalizzazione e patch direttamente dai pulsanti/etichette
- Calcolare il prezzo atteso dinamicamente:
  - Prezzo base letto + costo personalizzazione letto + costo patch letto
- Verificare che il prezzo visualizzato corrisponda al calcolo
- Verificare che il totale sia mostrato correttamente
- NOTA: i prezzi possono variare, non usare valori hardcoded ma sempre quelli letti dalla pagina

#### 3.5 Verifica Anteprima

- Controllare che l'anteprima mostri:
  - Nome giocatore o nome personalizzato
  - Numero
  - Patch selezionata
- Verificare che l'anteprima si aggiorni in tempo reale
- Verificare che le immagini dell'anteprima siano di buona qualità
- Verificare che non ci siano elementi sovrapposti o tagliati nell'anteprima

#### 3.6 Aggiunta al Carrello

- Cliccare "Aggiungi al carrello"
- Verificare che il carrello si apra/confermi l'aggiunta
- Controllare il contenuto del carrello:
  - Prodotto corretto
  - Taglia corretta
  - Personalizzazione corretta (nome, numero, patch)
  - Prezzo totale corretto
- Verificare che NON ci siano prodotti non selezionati dall'utente
- Verificare coerenza tra ciò che l'utente ha selezionato e ciò che finisce nel carrello

#### 3.7 Test Deselezione

- Deselezionare personalizzazioni già attivate (usare il pulsante di deselezione)
- Verificare che:
  - Il prezzo si aggiorni correttamente (diminuisca)
  - L'anteprima si aggiorni rimuovendo gli elementi deselezionati
  - I campi input si resettino se necessario
  - Il pulsante torni allo stato non attivo

#### 3.8 Test Edge Cases

- Testare cambio taglia dopo aver completato la personalizzazione
- Testare combinazioni multiple (Giocatore + Patch, Tuo Nome + Patch)
- Verificare che lo stato del personalizzatore persista durante la navigazione
- Testare deselezione e riselezione rapida per verificare stabilità

### 4. Monitoraggio Errori Tecnici

- Monitorare la console JavaScript per errori
- Monitorare le richieste HTTP per status 4xx o 5xx
- Verificare assenza di React warnings o errors
- Verificare che non ci siano elementi non cliccabili che dovrebbero esserlo
- Verificare che non ci siano pulsanti senza effetto
- Verificare che non ci siano pagine bianche o blank states
- Verificare che non ci siano loop di navigazione o re-rendering infiniti

### 5. Performance

- Verificare tempi di caricamento del componente React
- Verificare tempi di aggiornamento del prezzo dopo selezione
- Verificare tempi di aggiornamento dell'anteprima dopo input
- Documentare eventuali rallentamenti o lag
