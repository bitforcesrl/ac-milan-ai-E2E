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
- **Testare almeno 3 giocatori diversi scelti a random** dal dropdown:
  - Per ogni giocatore, verificare che nome e numero appaiano correttamente nell'anteprima
  - Verificare che il prezzo si mantenga consistente (stesso costo per tutti i giocatori)
  - Verificare che non ci siano problemi di encoding caratteri (es. caratteri speciali come ã, é, ñ)
  - Catturare screenshot per ogni giocatore testato
- **NOTA:** Il nome del giocatore nel dropdown è scritto in formato Title Case (es. "Rafa Leão"), ma l'anteprima sulla maglia mostra sempre il nome in UPPERCASE (es. "RAFA LEÃO"). Questo è il comportamento atteso e **NON è un errore**.

##### 3.2.2 Opzione "Tuo Nome" (se disponibile)

- Cliccare sul pulsante "Tuo Nome"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Verificare che i campi input appaiano

##### 3.2.3 Validazione Campi Input

- Testare il limite caratteri nome (verificare counter, es. 0/10)
- Testare il limite caratteri numero (verificare counter, es. 0/2)
- Testare input vuoti (verificare comportamento)
- **Testare caratteri accentati nel campo nome:** provare a inserire caratteri come à, è, é, ì, ò, ù e verificare che **NON vengano accettati** (devono essere bloccati o ignorati dall'input). Il campo nome deve accettare solo caratteri ASCII non accentati (A-Z, a-z).
- Testare altri caratteri speciali (verificare se accettati o bloccati)
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
- **NOTA:** È comportamento atteso che venga aggiunto automaticamente un prodotto omaggio (es. "Figurine Omaggio") al carrello. Questo NON è un bug ma una funzionalità promozionale del sito.

##### 3.6.1 Lettura Attributi Nascosti dei Line Items

**IMPORTANTE:** Oltre agli attributi visibili nell'UI del carrello, esistono attributi nascosti che vengono inviati al backend e sono fondamentali per la lavorazione dell'ordine. Questi attributi **NON sono visibili all'utente** nell'interfaccia del carrello, ma possono essere letti tramite l'API `cart.js` di Shopify.

**Come leggere gli attributi nascosti:**

1. Dalla pagina del carrello, eseguire il seguente codice JavaScript:
   ```javascript
   const response = await fetch('/cart.js');
   const cart = await response.json();
   console.log(JSON.stringify(cart.items, null, 2));
   ```
2. Per ogni line item, esaminare il campo `properties` che contiene tutti gli attributi (visibili e nascosti)
3. Gli attributi nascosti sono quelli che iniziano con `_` (underscore)

**Attributi nascosti da cercare e documentare nel report:**

Per il **line item della maglia**:

- `_customization`: indica se la maglia è personalizzata ("true")
- `_customizationId`: ID della personalizzazione
- `_newCE`: flag nuova personalizzazione
- `_customizationProducts`: lista di tutti i variant IDs correlati alla personalizzazione
- `_id`: ID univoco della sessione di personalizzazione

Per il **line item della personalizzazione (Giocatore/Tuo Nome)**:

- `_customizationProduct`: tipo di personalizzazione ("player" o "custom")
- `_customizationFontStyle`: stile del font (es. "Serie A")
- `_customizationFont`: font specifico usato
- `_customizationLetters`: nome del giocatore inserito
- `_customizationNumbers`: numero del giocatore
- `_customizationLettersStyle`: stile delle lettere
- `_customizationNumbersStyle`: stile dei numeri
- `_gender`: genere selezionato (es. "Uomo")
- `_customizationProducts`: lista di tutti i variant IDs correlati

Per i **line item degli add-on (Patch e Sponsor)**:

- `_customizationAddOnType`: tipo di add-on (es. "patch", "back_sponsor", "sleeve_sponsor", "front_sponsor")
- `_customizationProducts`: lista di tutti i variant IDs correlati

**Documentare nel report** tutti gli attributi nascosti trovati per ogni line item, organizzati in tabelle.

##### 3.6.2 Verifica Stili Caratteri da Immagini

**CONTESTO:** Gli attributi `_customizationLettersStyle` e `_customizationNumbersStyle` sono sottostringhe estratte dai nomi dei file delle immagini PNG utilizzate per renderizzare i caratteri (lettere e numeri) sulla maglia. Questi attributi identificano lo stile visivo dei caratteri applicati alla personalizzazione.

**Come funzionano:**

- Ogni carattere (lettera o numero) visualizzato sulla maglia è renderizzato utilizzando un'immagine PNG specifica
- Il nome del file PNG contiene un identificatore di stile (es. `seriea_letters_01.png`, `seriea_numbers_01.png`)
- Gli attributi `_customizationLettersStyle` e `_customizationNumbersStyle` contengono la sottostringa che identifica lo stile utilizzato
- Questi valori permettono al backend di sapere quale set di immagini è stato utilizzato per la personalizzazione

**Step di verifica:**

1. Dopo aver aggiunto il prodotto al carrello e letto il contenuto tramite `cart.js` (come descritto nella sezione 3.6.1):
   - Individuare il **line item della personalizzazione** (quello con `_customizationProduct` = "player" o "custom")
   - Estrarre il valore dell'attributo `_customizationLettersStyle` dalle `properties` del line item
   - Estrarre il valore dell'attributo `_customizationNumbersStyle` dalle `properties` del line item

2. **Validare i valori estratti:**
   - Verificare che `_customizationLettersStyle` sia una stringa **non vuota**
   - Verificare che `_customizationNumbersStyle` sia una stringa **non vuota**
   - Entrambi i valori dovrebbero essere presenti quando la personalizzazione è applicata (nome e/o numero inseriti)

3. **Correlazione con le immagini PNG:**
   - Documentare che il valore di `_customizationLettersStyle` corrisponde a una sottostringa presente nei nomi dei file PNG utilizzati per renderizzare le lettere del nome
   - Documentare che il valore di `_customizationNumbersStyle` corrisponde a una sottostringa presente nei nomi dei file PNG utilizzati per renderizzare i numeri
   - **Nota:** Non è necessario verificare i file PNG effettivi durante il test, ma è importante documentare che questi attributi esistono e sono popolati

**Comportamento Atteso:**

- `_customizationLettersStyle` deve contenere un identificatore di stile (es. "seriea", "official", ecc.) che corrisponde alla porzione di nome file delle immagini PNG usate per i caratteri lettera
- `_customizationNumbersStyle` deve contenere un identificatore di stile che corrisponde alla porzione di nome file delle immagini PNG usate per i caratteri numero
- Entrambi gli attributi devono essere **presenti e popolati** quando la personalizzazione è applicata (cioè quando è stato inserito un nome e/o un numero)
- Se la personalizzazione non è applicata (nessun nome/numero), questi attributi potrebbero essere assenti o vuoti

**Documentazione nel Report:**

- Includere `_customizationLettersStyle` e `_customizationNumbersStyle` nella tabella degli attributi nascosti del line item di personalizzazione
- Riportare i valori effettivi trovati durante il test
- Esempio di tabella:

| Attributo                    | Valore Trovato | Note                        |
| ---------------------------- | -------------- | --------------------------- |
| `_customizationLettersStyle` | `seriea`       | Stile caratteri per lettere |
| `_customizationNumbersStyle` | `seriea`       | Stile caratteri per numeri  |

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

#### 3.9 Rimozione dal Carrello

- Aprire il carrello (se non già aperto)
- Identificare il prodotto aggiunto in precedenza
- Cliccare su "Rimuovi" per il prodotto personalizzato
- Verificare che:
  - Il prodotto venga rimosso correttamente dal carrello
  - Il totale del carrello si aggiorni (diminuisca dell'importo corretto)
  - Il carrello risulti vuoto (o mostri solo gli altri eventuali prodotti)
  - Non ci siano residui di personalizzazione nel carrello
- Questo step è fondamentale per garantire che lo stato del carrello sia pulito per il test successivo

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
