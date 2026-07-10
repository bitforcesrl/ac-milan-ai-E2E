# Quick Buy (Homepage Personalizer) QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto rapido (quick-buy) tramite il componente "PERSONALIZZA LA TUA MAGLIA DEL MILAN" presente nella Homepage del sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Workflow di Testing

### 1. Analisi Componente Quick-Buy

- Verificare presenza elementi:
  - Titolo sezione "PERSONALIZZA LA TUA MAGLIA DEL MILAN"
  - Selettore tipo maglia (Home/Away/Third) - **NOTA: in alcuni periodi potrebbe essere disponibile solo "Home"**
  - Selettore genere (Uomo/Donna/Bambino)
  - Selettore modello (Autentica/Replica) - non sempre presente
  - Selettore manica (Corta/Lunga) - non sempre presente
  - Selettore taglia
  - Sezione personalizzazione (Nome e Numero, Patch)
  - Pulsante "Aggiungi al carrello" con prezzo dinamico
  - Anteprima maglia (Front/Back)

### 2. Test del Flusso Quick-Buy

Eseguire le seguenti azioni in sequenza:

#### 2.1 Selezione Tipo Maglia (Home/Away/Third)

- Identificare le opzioni disponibili per il tipo di maglia
- **NOTA: in alcuni periodi potrebbe essere disponibile solo "Home"**
- Selezionare "Home" (default)
- Verificare che:
  - L'anteprima mostri la maglia Home corretta
  - Il prezzo base sia visualizzato correttamente
  - Il titolo dell'immagine nell'anteprima corrisponda alla maglia selezionata
- Selezionare "Away" (se disponibile)
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia Away
  - Il prezzo base si aggiorni correttamente
  - Il titolo dell'immagine nell'anteprima cambi
- Selezionare "Third" (se disponibile)
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia Third
  - Il prezzo base si aggiorni correttamente
  - Il titolo dell'immagine nell'anteprima cambi
- Tornare a "Home" per verificare la persistenza

#### 2.2 Selezione Genere (Uomo/Donna/Bambino)

##### 2.2.1 Test Genere Uomo

- Selezionare "Uomo"
- Verificare che:
  - Le opzioni modello (Autentica/Replica) siano disponibili
  - Le opzioni manica (Corta/Lunga) siano disponibili
  - Le taglie disponibili siano XS/S/M/L/XL/XXL
  - Il prezzo base sia quello della maglia uomo
  - I costi di personalizzazione siano visualizzati correttamente

##### 2.2.2 Test Genere Donna

- Selezionare "Donna"
- Verificare che:
  - Le opzioni modello (Autentica/Replica) siano disponibili (se applicabile)
  - Le opzioni manica (Corta/Lunga) siano disponibili (se applicabile)
  - Le taglie disponibili siano appropriate per donna
  - Il prezzo base si aggiorni correttamente
  - I costi di personalizzazione si aggiornino correttamente

##### 2.2.3 Test Genere Bambino

- Selezionare "Bambino"
- Verificare che:
  - Il modello cambi automaticamente a "Replica" (Autentica non disponibile per bambino)
  - La manica rimanga "Corta" (o vericare se Lunga è disponibile)
  - Le taglie disponibili cambino a "6 anni, 8 anni, 10 anni, 12 anni, 14 anni, 16 anni"
  - Il prezzo base si aggiorni correttamente (prezzo bambino)
  - I costi di personalizzazione si aggiornino correttamente (prezzi diversi da adulto)
  - **IMPORTANTE:** Verificare che il limite caratteri per "Tuo Nome" sia 7 caratteri (non 10 come per adulto)

#### 2.3 Selezione Modello (Autentica/Replica)

- Tornare a genere "Uomo" per testare le opzioni complete
- Selezionare "Autentica"
- Verificare che:
  - Il prezzo base si aggiorni correttamente
  - L'anteprima mostri la maglia autentica
  - Il titolo dell'immagine nell'anteprima contenga "AUTHENTIC"
- Selezionare "Replica"
- Verificare che:
  - Il prezzo base si aggiorni correttamente (diminuisca)
  - L'anteprima si aggiorni
  - Il titolo dell'immagine nell'anteprima cambi

#### 2.4 Selezione Manica (Corta/Lunga)

- Con genere "Uomo" e modello "Autentica" selezionati
- Selezionare "Corta"
- Verificare che:
  - Il prezzo base sia visualizzato correttamente
  - L'anteprima mostri la maglia a manica corta
- Selezionare "Lunga"
- Verificare che:
  - Il prezzo base si aggiorni correttamente (aumenti)
  - L'anteprima si aggiorni mostrando la maglia a manica lunga
  - Il titolo dell'immagine nell'anteprima contenga "MANICHE LUNGHE" o simile

#### 2.5 Selezione Taglia

- Identificare le taglie disponibili
- Selezionare una taglia (es. M)
- Verificare che:
  - La selezione sia evidenziata visivamente
  - Le taglie non disponibili siano disabilitate
  - Il click sulla taglia abbia feedback visivo immediato
- Cambiare taglia (es. L)
- Verificare che la selezione si aggiorni correttamente

#### 2.6 Personalizzazione - Nome e Numero

##### 2.6.1 Opzione "Giocatore"

- Cliccare sul pulsante "Giocatore"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Selezionare un giocatore dal dropdown
- Verificare che il nome e numero appaiano nell'anteprima
- **Verificare che il nome sia centrato sull'asse Y della maglia**
- Verificare che il dropdown contenga la lista completa dei giocatori
- **Testare almeno 3 giocatori diversi scelti a random** dal dropdown:
  - Per ogni giocatore, verificare che nome e numero appaiano correttamente nell'anteprima
  - **Verificare che il nome sia centrato orizzontalmente sull'asse Y**
  - Verificare che il prezzo si mantenga consistente (stesso costo per tutti i giocatori)
  - Verificare che non ci siano problemi di encoding caratteri (es. caratteri speciali come ã, é, ñ)
  - Catturare screenshot per ogni giocatore testato
- **NOTA:** Il nome del giocatore nel dropdown è scritto in formato Title Case (es. "Rafa Leão"), ma l'anteprima sulla maglia mostra sempre il nome in UPPERCASE (es. "RAFA LEÃO"). Questo è il comportamento atteso e **NON è un errore**.

##### 2.6.2 Opzione "Tuo Nome"

- Cliccare sul pulsante "Tuo Nome"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Verificare che i campi input appaiano

##### 2.6.3 Validazione Campi Input - Genere Adulto (Uomo/Donna)

- Con genere "Uomo" o "Donna" selezionato
- Testare il limite caratteri nome (verificare counter, es. 0/10)
- Testare il limite caratteri numero (verificare counter, es. 0/2)
- Testare input vuoti (verificare comportamento)
- Testare caratteri speciali (verificare se accettati o bloccati)
- Verificare che il counter si aggiorni dinamicamente durante la digitazione
- Verificare che il nome e numero appaiano nell'anteprima in tempo reale
- **Verificare che il nome personalizzato sia centrato sull'asse Y della maglia**

##### 2.6.4 Validazione Campi Input - Genere Bambino

- Selezionare genere "Bambino"
- Testare il limite caratteri nome (verificare counter, es. 0/7)
- **IMPORTANTE:** Verificare che il limite massimo sia 7 caratteri (non 10 come per adulto)
- Testare il limite caratteri numero (verificare counter, es. 0/2)
- Testare input vuoti (verificare comportamento)
- Testare caratteri speciali (verificare se accettati o bloccati)
- Verificare che il counter si aggiorni dinamicamente durante la digitazione
- Verificare che il nome e numero appaiano nell'anteprima in tempo reale
- **Verificare che il nome personalizzato sia centrato sull'asse Y della maglia**

#### 2.7 Personalizzazione - Patch

- Selezionare una patch disponibile (es. SERIE A)
- Verificare che:
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - La patch appaia nell'anteprima
  - Il pulsante mostri che la patch è attiva (stato active)

#### 2.8 Verifica Prezzo

- Leggere il prezzo base mostrato al caricamento
- Leggere i costi di personalizzazione e patch direttamente dai pulsanti/etichette
- Calcolare il prezzo atteso dinamicamente:
  - Prezzo base letto + costo personalizzazione letto + costo patch letto
- Verificare che il prezzo visualizzato corrisponda al calcolo
- Verificare che il totale sia mostrato correttamente nel pulsante "Aggiungi al carrello"
- NOTA: i prezzi possono variare, non usare valori hardcoded ma sempre quelli letti dalla pagina

#### 2.9 Verifica Anteprima

- Controllare che l'anteprima mostri:
  - Nome giocatore o nome personalizzato
  - Numero
  - Patch selezionata
- **Verificare che la scritta (nome) sia centrata sull'asse Y della maglia**
- Verificare che l'anteprima si aggiorni in tempo reale
- Verificare che le immagini dell'anteprima siano di buona qualità
- Verificare che non ci siano elementi sovrapposti o tagliati nell'anteprima
- Testare i pulsanti "Front" e "Back" per vedere entrambi i lati della maglia

#### 2.10 Test Persistenza Personalizzazione al Cambio Maglia

**Questo test è fondamentale per verificare che le personalizzazioni rimangano applicate quando si cambia maglia.**

##### 2.10.1 Setup Iniziale

- Selezionare genere "Uomo", modello "Autentica", manica "Corta", taglia "M"
- Selezionare "Tuo Nome" e inserire un nome personalizzato (es. "ROSSONERI")
- Inserire un numero (es. "99")
- Selezionare patch "SERIE A"
- Verificare che tutte le personalizzazioni siano visibili nell'anteprima
- Annotare il prezzo totale

##### 2.10.2 Cambio Tipo Maglia (Home → Away)

- Cambiare il tipo di maglia da "Home" a "Away"
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia Away
  - **Le personalizzazioni (nome, numero, patch) rimangano applicate**
  - Il prezzo si aggiorni correttamente (potrebbe cambiare il prezzo base)
  - Il nome sia ancora centrato sull'asse Y

##### 2.10.3 Cambio Tipo Maglia (Away → Third)

- Cambiare il tipo di maglia da "Away" a "Third" (se disponibile)
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia Third
  - **Le personalizzazioni (nome, numero, patch) rimangano applicate**
  - Il prezzo si aggiorni correttamente
  - Il nome sia ancora centrato sull'asse Y

##### 2.10.4 Cambio Genere (Uomo → Donna)

- Cambiare genere da "Uomo" a "Donna"
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia donna
  - **Le personalizzazioni (nome, numero, patch) rimangano applicate**
  - Il prezzo si aggiorni correttamente
  - Le taglie disponibili cambino
  - Il nome sia ancora centrato sull'asse Y

##### 2.10.5 Cambio Genere (Donna → Bambino)

- Cambiare genere da "Donna" a "Bambino"
- Verificare che:
  - L'anteprima si aggiorni mostrando la maglia bambino
  - **Le personalizzazioni (nome, numero, patch) rimangano applicate**
  - Il prezzo si aggiorni correttamente (prezzo bambino)
  - Le taglie disponibili cambino a "6-16 anni"
  - **IMPORTANTE:** Se il nome inserito supera 7 caratteri, verificare che venga troncato o che ci sia un messaggio di errore
  - Il nome sia ancora centrato sull'asse Y

##### 2.10.6 Ritorno a Maglia Iniziale

- Tornare a genere "Uomo", tipo maglia "Home"
- Verificare che:
  - Le personalizzazioni siano ancora applicate
  - Il prezzo sia corretto
  - Il nome sia centrato sull'asse Y

#### 2.11 Aggiunta al Carrello

- Cliccare "Aggiungi al carrello"
- Verificare che il carrello si apra/confermi l'aggiunta
- Controllare il contenuto del carrello:
  - Prodotto corretto (tipo maglia, genere, modello, manica, taglia)
  - Personalizzazione corretta (nome, numero, patch)
  - Prezzo totale corretto
- Verificare che NON ci siano prodotti non selezionati dall'utente
- Verificare coerenza tra ciò che l'utente ha selezionato e ciò che finisce nel carrello
- **NOTA:** È comportamento atteso che venga aggiunto automaticamente un prodotto omaggio (es. "Figurine Omaggio") al carrello. Questo NON è un bug ma una funzionalità promozionale del sito.

#### 2.12 Test Deselezione

- Deselezionare personalizzazioni già attivate (usare il pulsante di deselezione)
- Verificare che:
  - Il prezzo si aggiorni correttamente (diminuisca)
  - L'anteprima si aggiorni rimuovendo gli elementi deselezionati
  - I campi input si resettino se necessario
  - Il pulsante torni allo stato non attivo

#### 2.13 Test Edge Cases

- Testare cambio taglia dopo aver completato la personalizzazione
- Testare combinazioni multiple (Giocatore + Patch, Tuo Nome + Patch)
- Verificare che lo stato del personalizzatore persista durante la navigazione
- Testare deselezione e riselezione rapida per verificare stabilità
- Testare cambio rapido tra Home/Away/Third con personalizzazioni applicate
- Testare cambio rapido tra Uomo/Donna/Bambino con personalizzazioni applicate

#### 2.14 Rimozione dal Carrello

- Aprire il carrello (se non già aperto)
- Identificare il prodotto aggiunto in precedenza
- Cliccare su "Rimuovi" per il prodotto personalizzato
- Verificare che:
  - Il prodotto venga rimosso correttamente dal carrello
  - Il totale del carrello si aggiorni (diminuisca dell'importo corretto)
  - Il carrello risulti vuoto (o mostri solo gli altri eventuali prodotti)
  - Non ci siano residui di personalizzazione nel carrello
- Questo step è fondamentale per garantire che lo stato del carrello sia pulito per il test successivo

#### 2.15 Test Combinazioni Prodotti

**IMPORTANTE:** Per ogni combinazione di prodotto, devi testare TUTTE e tre le personalizzazioni:

1. **Giocatore** (almeno 3 giocatori diversi scelti a random)
2. **Tuo Nome** + Numero (inserire nome e numero personalizzati)
3. **Patch** (selezionare SERIE A o altra patch disponibile)

##### 2.15.1 Piano Test Combinazioni

Prima di iniziare il test, identifica tutte le combinazioni possibili basandoti sulle opzioni disponibili nel componente. Le combinazioni tipiche sono:

**Genere Uomo:**

- Uomo - Autentica - Corta (se disponibile)
- Uomo - Autentica - Lunga (se disponibile)
- Uomo - Replica - Corta (se disponibile)
- Uomo - Replica - Lunga (se disponibile)

**Genere Donna:**

- Donna - Replica - Corta (se disponibile)
- Donna - Replica - Lunga (se disponibile)

**Genere Bambino:**

- Bambino - Replica - Corta (Autentica non disponibile per bambino)

**NOTA:** Alcune combinazioni potrebbero non essere disponibili (es. Donna Autentica, Bambino Autentica/Lunga). Verifica di volta in volta quali opzioni sono effettivamente selezionabili.

##### 2.15.2 Esecuzione Test per Ogni Combinazione

Per **OGNI** combinazione identificata, eseguire i seguenti step:

1. **Selezionare la combinazione** (Genere + Modello + Manica)
2. **Selezionare una taglia** disponibile (es. M per adulto, 10 anni per bambino)
3. **Testare Giocatore:**
   - Cliccare "Giocatore"
   - Selezionare 3 giocatori diversi a random dal dropdown
   - Per ogni giocatore:
     - Verificare che nome e numero appaiano nell'anteprima
     - Verificare che il nome sia centrato sull'asse Y
     - Verificare che il prezzo si aggiorni correttamente
     - Catturare screenshot
   - Deselezionare il giocatore prima di passare al test successivo
4. **Testare Tuo Nome:**
   - Cliccare "Tuo Nome"
   - Inserire un nome personalizzato (max 10 char per adulto, max 7 char per bambino)
   - Inserire un numero (es. "99")
   - Verificare che nome e numero appaiano nell'anteprima
   - Verificare che il nome sia centrato sull'asse Y
   - Verificare che il prezzo si aggiorni correttamente
   - Catturare screenshot
   - Deselezionare prima di passare al test successivo
5. **Testare Patch:**
   - Cliccare "SERIE A" (o altra patch disponibile)
   - Verificare che la patch appaia nell'anteprima
   - Verificare che il prezzo si aggiorni correttamente
   - Catturare screenshot
   - Deselezionare la patch
6. **Rimuovere il prodotto dal carrello** (se aggiunto) prima di passare alla combinazione successiva

##### 2.15.3 Verifica Trasversale

Durante il test delle combinazioni, verificare che:

- I prezzi si aggiornino correttamente per ogni combinazione
- Le personalizzazioni (giocatore, nome, patch) funzionino per TUTTE le combinazioni
- La centratura del nome sull'asse Y sia mantenuta per tutte le combinazioni
- Non ci siano errori console o problemi di rendering
- Il pulsante "Aggiungi al carrello" sia sempre abilitato quando la taglia è selezionata

### 3. Verifica Centratura Scritta sull'Asse Y

**Questo test deve essere eseguito per ogni tipo di personalizzazione del nome.**

- Dopo aver selezionato un giocatore o inserito un nome personalizzato
- Verificare visivamente che il nome sia centrato orizzontalmente sull'asse Y della maglia
- Controllare che il nome non sia troppo alto o troppo basso rispetto alla posizione centrale
- Verificare che la centratura sia mantenuta anche dopo:
  - Cambio tipo maglia (Home/Away/Third)
  - Cambio genere (Uomo/Donna/Bambino)
  - Cambio modello (Autentica/Replica)
  - Cambio manica (Corta/Lunga)
  - Cambio taglia
- Se la centratura non è corretta, documentare con screenshot e descrivere il problema

---

## Output del Report

**IMPORTANTE:** Il report finale deve contenere **SOLO** bug, problemi e anomalie trovate durante il test.

### Cosa INCLUDERE nel report:

- Bug trovati (con severity, descrizione, steps to reproduce, expected vs actual)
- Problemi UX/UI identificati
- Errori tecnici (console errors, network issues)
- Screenshot che mostrano i problemi
- Raccomandazioni per fix

### Cosa NON INCLUDERE nel report:

- Test risultati positivi (es. "✅ Prezzo corretto", "✅ Funzionalità OK")
- Liste di verifiche superate
- Riepiloghi di funzionalità che funzionano correttamente
- Tabelle con status "PASS"

Il report deve essere focalizzato esclusivamente su ciò che **non funziona** o che necessita di miglioramenti. Se un test non rivela bug, il report sarà minimale o vuoto.

---

## Note Specifiche Quick-Buy

- **Verificare che la personalizzazione funzioni anche quando si cambia maglia**
- **Le parti della personalizzazione devono rimanere applicate quando si cambia maglia**
- **Nota:** quando si passa a bambino il nome libero inserito dall'utente ha una validazione di max 7char mentre per gli altri casi 10char
- **Controllare che la scritta sulla maglia sia centrata sull'asse y**
- **Il tipo di maglia potrebbe essere solo Home** (non sempre sono disponibili Away/Third)
