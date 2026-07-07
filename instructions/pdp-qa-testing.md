# PDP (Product Detail Page) QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto sulla Product Detail Page (PDP) del sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Workflow di Testing

### 1. Apertura PDP

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
