# Quick Buy (Homepage Personalizer) QA Testing - Instructions

## Obiettivo

Testare il flusso di personalizzazione e acquisto rapido (quick-buy) tramite il componente "PERSONALIZZA LA TUA MAGLIA DEL MILAN" presente nella Homepage del sito e-commerce AC Milan Store, identificando bug e problemi UX.

## Workflow di Testing

### 1. Test Combinazioni Prodotti

**Obiettivo:** Verificare che tutte le combinazioni di prodotto si carichino correttamente.

#### 1.1 Scoperta Dinamica delle Combinazioni

**IMPORTANTE:** La matrice delle combinazioni NON è fissa ma varia in base alla stagione e alla disponibilità. Devi scoprire dinamicamente quali opzioni sono disponibili durante il test.

**Procedura di scoperta:**

1. **Identifica le opzioni disponibili per ogni selettore:**
   - **Tipo Maglia:** Clicca sul selettore e annota quali opzioni sono presenti (es. Home, Away, Third - o solo Home se le altre non sono disponibili)
   - **Genere:** Clicca sul selettore e annota quali opzioni sono presenti (es. Uomo, Donna, Bambino)
   - **Modello:** Clicca sul selettore e annota quali opzioni sono presenti (es. Autentica, Replica - o solo Replica se Autentica non è disponibile)
   - **Manica:** Clicca sul selettore e annota quali opzioni sono presenti (es. Corta, Lunga - o solo Corta se Lunga non è disponibile)

2. **Costruisci la matrice delle combinazioni disponibili:**
   - Combina tutte le opzioni disponibili per creare la lista completa delle combinazioni testabili
   - Esempio: Se Tipo Maglia ha [Home, Away], Genere ha [Uomo, Donna], Modello ha [Autentica, Replica], Manica ha [Corta], la matrice sarà: Home×Uomo×Autentica×Corta, Home×Uomo×Replica×Corta, Home×Donna×Autentica×Corta, Home×Donna×Replica×Corta, Away×Uomo×Autentica×Corta, Away×Uomo×Replica×Corta, Away×Donna×Autentica×Corta, Away×Donna×Replica×Corta

3. **Documenta la matrice scoperta:**
   - Annota la matrice completa nel report finale (sezione "Matrice Combinazioni Disponibili")
   - Questa documentazione è fondamentale per tracciare quali combinazioni erano disponibili al momento del test

#### 1.2 Procedura per Ogni Combinazione

Per ogni combinazione della matrice:

1. **Selezionare la combinazione** (Tipo Maglia + Genere + Modello + Manica)
2. **Verificare che il prodotto si carichi correttamente:**
   - L'anteprima mostri la maglia corretta
   - Il prezzo base sia visualizzato
   - Non ci siano errori visibili
   - Le taglie disponibili siano appropriate per il genere selezionato
3. **Passare alla combinazione successiva** (NON aggiungere al carrello, NON testare personalizzazioni in questa fase)

#### 1.3 Verifica Trasversale

Durante il test delle combinazioni, verificare che:

- I prezzi si aggiornino correttamente per ogni combinazione
- Non ci siano errori console o problemi di rendering
- Le taglie disponibili cambino correttamente in base al genere

---

### 2. Test Personalizzazione sulla Maglia Principale

**Obiettivo:** Testare in dettaglio tutte le opzioni di personalizzazione sulla maglia Home/Uomo/Autentica.

#### 2.1 Setup Iniziale

- Selezionare: Tipo Maglia = **Home**, Genere = **Uomo**, Modello = **Autentica**, Manica = **Corta**
- Selezionare una taglia (es. M)

#### 2.2 Test Personalizzazione Libera (Tuo Nome)

**IMPORTANTE:** Questo test va eseguito PRIMA di testare la personalizzazione con giocatore.

- Cliccare sul pulsante "Tuo Nome"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Inserire un nome personalizzato (nome random)
- Inserire un numero (numero random di due cifre)
- Verificare che:
  - Il nome e numero appaiano nell'anteprima in tempo reale
  - **Il nome sia centrato sull'asse Y della maglia**
  - Il counter caratteri si aggiorni dinamicamente (es. 0/10)
  - Il prezzo si aggiorni correttamente
  - I caratteri speciali vengano accettati/bloccati correttamente
- Deselezionare "Tuo Nome" prima di passare al test successivo

#### 2.3 Test Personalizzazione Giocatore

##### 2.3.1 Selezione Giocatore

- Cliccare sul pulsante "Giocatore"
- Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
- Selezionare un giocatore dal dropdown
- Verificare che:
  - Il nome e numero appaiano nell'anteprima
  - **Il nome sia centrato sull'asse Y della maglia**
  - Il dropdown contenga la lista completa dei giocatori
  - Il prezzo si aggiorni correttamente

##### 2.3.2 Test Multipli Giocatori

- **Testare almeno 3 giocatori diversi scelti a random** dal dropdown:
  - Per ogni giocatore, verificare che nome e numero appaiano correttamente nell'anteprima
  - **Verificare che il nome sia centrato orizzontalmente sull'asse Y**
  - Verificare che il prezzo si mantenga consistente (stesso costo per tutti i giocatori)
  - Verificare che non ci siano problemi di encoding caratteri (es. caratteri speciali come ã, é, ñ)
  - Catturare screenshot per ogni giocatore testato

**NOTA:** Il nome del giocatore nel dropdown è scritto in formato Title Case (es. "Rafa Leão"), ma l'anteprima sulla maglia mostra sempre il nome in UPPERCASE (es. "RAFA LEÃO"). Questo è il comportamento atteso e **NON è un errore**.

#### 2.4 Test Personalizzazione Patch

- Selezionare una patch disponibile (es. SERIE A)
- Verificare che:
  - Leggere il costo indicato sul pulsante (es. "+ €X") e verificare che il prezzo si aggiorni dinamicamente di quell'importo
  - La patch appaia nell'anteprima
  - Il pulsante mostri che la patch è attiva (stato active)

#### 2.5 Verifica Prezzo Finale

- Leggere il prezzo base mostrato al caricamento
- Leggere i costi di personalizzazione e patch direttamente dai pulsanti/etichette
- Calcolare il prezzo atteso dinamicamente:
  - Prezzo base letto + costo personalizzazione letto + costo patch letto
- Verificare che il prezzo visualizzato corrisponda al calcolo
- Verificare che il totale sia mostrato correttamente nel pulsante "Aggiungi al carrello"

**NOTA:** i prezzi possono variare, non usare valori hardcoded ma sempre quelli letti dalla pagina

#### 2.6 Verifica Anteprima

- Controllare che l'anteprima mostri:
  - Nome giocatore
  - Numero
  - Patch selezionata
- **Verificare che la scritta (nome) sia centrata sull'asse Y della maglia**
- Verificare che l'anteprima si aggiorni in tempo reale
- Verificare che le immagini dell'anteprima siano di buona qualità
- Verificare che non ci siano elementi sovrapposti o tagliati nell'anteprima
- Testare i pulsanti "Front" e "Back" per vedere entrambi i lati della maglia

---

### 3. Test Personalizzazione su Tutte le Combinazioni

**Obiettivo:** Verificare che la personalizzazione (player e patch) funzioni correttamente su tutte le 6 combinazioni di prodotto scoperte nella Sezione 1.

**IMPORTANTE:** Questo test va eseguito DOPO aver completato la Sezione 2 (test sulla maglia principale).

#### 3.1 Procedura per Ogni Combinazione

Per ogni combinazione della matrice scoperta nella Sezione 1:

1. **Selezionare la combinazione** (Genere + Modello + Manica)
2. **Selezionare una taglia** disponibile
3. **Testare Personalizzazione Giocatore:**
   - Cliccare "Giocatore"
   - Selezionare un giocatore dal dropdown
   - Verificare che nome e numero appaiano nell'anteprima
   - Verificare che il prezzo si aggiorni correttamente
4. **Testare Personalizzazione Patch:**
   - Cliccare "SERIE A" (o altra patch disponibile)
   - Verificare che la patch appaia nell'anteprima
   - Verificare che il prezzo si aggiorni correttamente
5. **Passare alla combinazione successiva**

#### 3.2 Combinazioni da Testare

Testare tutte le 6 combinazioni scoperte nella Sezione 1:

#### 3.3 Verifica Trasversale

Durante il test delle combinazioni, verificare che:

- I prezzi si aggiornino correttamente per ogni combinazione
- La personalizzazione (player e patch) rimanga applicata per TUTTE le combinazioni
- La centratura del nome sull'asse Y sia mantenuta per tutte le combinazioni. USA VISION e salva uno screenshot per ogni combinazione testata
- Non ci siano errori console o problemi di rendering

---

## Note Specifiche Quick-Buy

- **Verificare che la personalizzazione funzioni anche quando si cambia maglia**
- **Le parti della personalizzazione devono rimanere applicate quando si cambia maglia**
- **Controllare che la scritta sulla maglia sia centrata sull'asse y**
- **Il tipo di maglia potrebbe essere solo Home** (non sempre sono disponibili Away/Third)
- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.
