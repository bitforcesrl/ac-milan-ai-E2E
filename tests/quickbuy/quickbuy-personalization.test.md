# Quick Buy - Personalization Test

## Obiettivo

Testare in dettaglio tutte le opzioni di personalizzazione del personalizzatore Quick-Buy, verificando che nome, numero, giocatore e patch vengano applicati correttamente sull'anteprima della maglia e che la personalizzazione rimanga attiva quando si cambia tipo di maglia.

### Configurazione Base

Selezionare la seguente combinazione come base per tutti i test:

- **Tipo Maglia:** Home
- **Genere:** Uomo
- **Modello:** Autentica
- **Manica:** Corta
- **Taglia:** Prima taglia disponibile

---

## Fase 1: Test Personalizzazione Libera (Tuo Nome)

**IMPORTANTE:** Questo test va eseguito PRIMA di testare la personalizzazione con giocatore.

### 1.1 Attivazione Personalizzazione Libera

1. Cliccare sul pulsante "Tuo Nome"
2. **Leggere il costo indicato sul pulsante** (es. "+ €X") e annotarlo
3. Verificare che il prezzo si aggiorni dinamicamente aggiungendo quel costo

### 1.2 Inserimento Dati

1. Inserire un **nome personalizzato** (usare un nome random)
2. Inserire un **numero** (usare un numero random di due cifre)
3. Verificare che:
   - Il nome e numero appaiano nell'anteprima in tempo reale
   - **Il nome sia centrato sull'asse Y della maglia** (verifica visiva con screenshot)
   - Il counter caratteri si aggiorni dinamicamente (es. 0/10, 5/10)
   - Il prezzo si aggiorni correttamente (prezzo base + costo personalizzazione)
   - I caratteri speciali vengano accettati/bloccati correttamente (testare con caratteri come à, è, ò)

### 1.3 Verifica Visiva

- Catturare screenshot dell'anteprima con nome e numero applicati
- Verificare che la scritta sia centrata orizzontalmente sull'asse Y
- Verificare che non ci siano elementi sovrapposti o tagliati

### 1.4 Deselezione

- **Deselezionare "Tuo Nome"** prima di passare al test successivo
- Verificare che il prezzo torni al valore base

---

## Fase 2: Test Personalizzazione Giocatore

### 2.1 Attivazione Personalizzazione Giocatore

1. Cliccare sul pulsante "Giocatore"
2. **Leggere il costo indicato sul pulsante** (es. "+ €X") e annotarlo
3. Verificare che il prezzo si aggiorni dinamicamente aggiungendo quel costo

### 2.2 Test Singolo Giocatore

1. Selezionare un giocatore dal dropdown
2. Verificare che:
   - Il nome e numero appaiano nell'anteprima
   - **Il nome sia centrato sull'asse Y della maglia** (verifica visiva)
   - Il dropdown contenga la lista completa dei giocatori
   - Il prezzo si aggiorni correttamente

### 2.3 Test Multipli Giocatori (3 Giocatori)

**Testare almeno 3 giocatori diversi scelti a random dal dropdown:**

Per ogni giocatore:

1. Selezionare un giocatore diverso dal dropdown
2. Verificare che nome e numero appaiano correttamente nell'anteprima
3. **Verificare che il nome sia centrato orizzontalmente sull'asse Y** (screenshot)
4. Verificare che il prezzo si mantenga consistente (stesso costo per tutti i giocatori)
5. Verificare che non ci siano problemi di encoding caratteri (es. caratteri speciali come ã, é, ñ, ĩ)
6. Catturare screenshot per ogni giocatore testato

**NOTA:** Il nome del giocatore nel dropdown è scritto in formato Title Case (es. "Rafa Leão"), ma l'anteprima sulla maglia mostra sempre il nome in UPPERCASE (es. "RAFA LEÃO"). Questo è il comportamento atteso e **NON è un errore**.

### 2.4 Documentazione Giocatori Testati

Documentare nel report i 3 giocatori testati:

- Nome giocatore (come appare nel dropdown)
- Nome giocatore (come appare sull'anteprima)
- Numero assegnato
- Screenshot dell'anteprima

---

## Fase 3: Test Add-On (Patch e Sponsor)

**IMPORTANTE:** Gli add-on includono sia **patch** (es. SERIE A, UEFA Champions League, Scudetto) che **sponsor** (es. sponsor principale, sponsor manica). Tutti gli add-on sono **opzionali** e la loro disponibilità **varia in base alla stagionalità** e al tipo di maglia selezionata.

### 3.1 Scoperta Dinamica degli Add-On Disponibili

1. **Identificare tutti gli add-on disponibili** nella sezione dedicata:
   - **Patch:** stemmi competizioni (SERIE A, Champions League, Coppa Italia, etc.)
   - **Sponsor:** loghi sponsor (sponsor principale, sponsor manica, etc.)
2. **Annotare la lista completa** degli add-on disponibili al momento del test
3. **Documentare nel report** quali add-on erano disponibili e quali no

**NOTA:** La disponibilità degli add-on può variare in base a:

- Tipo di maglia selezionata (Home/Away/Third)
- Stagionalità (alcune patch sono specifiche per competizioni in corso)
- Disponibilità sponsor (alcuni sponsor possono cambiare durante la stagione)

### 3.2 Test Singolo Add-On

Per ogni add-on disponibile (patch o sponsor):

1. Cliccare sul pulsante dell'add-on
2. **Leggere il costo indicato sul pulsante** (es. "+ €X") e annotarlo
3. Verificare che:
   - L'add-on appaia nell'anteprima nella posizione corretta
   - Il pulsante mostri che l'add-on è attivo (stato active)
   - Il prezzo si aggiorni correttamente aggiungendo quel costo
4. Catturare screenshot dell'anteprima

### 3.3 Applicazione Tutti gli Add-On

1. Applicare **tutti gli add-on disponibili** contemporaneamente (sia patch che sponsor)
2. Verificare che:
   - Tutti gli add-on appaiano nell'anteprima
   - I prezzi si aggiornino correttamente (somma di tutti i costi)
   - Non ci siano sovrapposizioni visive tra patch e sponsor
   - L'anteprima mostri correttamente tutti gli add-on applicati
   - Ogni add-on sia nella posizione corretta (patch su una spalla, sponsor sul petto, etc.)

### 3.4 Verifica Visiva

- Catturare screenshot dell'anteprima con tutti gli add-on applicati
- Verificare che patch e sponsor siano posizionati correttamente (non sovrapposti)
- Verificare che la qualità delle immagini sia buona
- Verificare che gli sponsor siano leggibili e non distorti

### 3.5 Documentazione Add-On Testati

Documentare nel report tutti gli add-on testati:

| Tipo Add-On | Nome Add-On | Costo | Posizione Anteprima | Stato |
| ----------- | ----------- | ----- | ------------------- | ----- |
| Patch       | SERIE A     | €X    | Spalla destra       | ✓     |
| Sponsor     | Emirates    | €X    | Petto               | ✓     |
| ...         | ...         | ...   | ...                 | ...   |

---

## Fase 4: Test Personalizzazione su Maglia Donna e Bambino

**Obiettivo:** Verificare che la personalizzazione (giocatore + tutti gli add-on: patch e sponsor) rimanga applicata quando si cambia tipo di maglia.

### 4.1 Setup Iniziale

- Mantenere la selezione di un giocatore attivo
- Mantenere tutti gli add-on applicati (sia patch che sponsor)
- Annotare la configurazione corrente:
  - Giocatore selezionato: [nome]
  - Add-on applicati: [lista patch e sponsor]
  - Prezzo totale: [€XXX]

### 4.2 Test su Maglia Donna

1. Cambiare **Genere** da "Uomo" a "Donna"
2. Selezionare la **prima taglia disponibile** per donna
3. Verificare che:
   - La personalizzazione (giocatore) rimanga applicata
   - Tutti gli add-on (patch e sponsor) rimangano applicati
   - Il nome del giocatore sia centrato sull'asse Y della maglia donna
   - Il prezzo si aggiorni correttamente per la maglia donna
   - L'anteprima mostri correttamente la maglia donna con personalizzazione e add-on
4. Catturare screenshot dell'anteprima

### 4.3 Test su Maglia Bambino

1. Cambiare **Genere** da "Donna" a "Bambino"
2. Selezionare la **prima taglia disponibile** per bambino
3. Verificare che:
   - La personalizzazione (giocatore) rimanga applicata
   - Tutti gli add-on (patch e sponsor) rimangano applicati
   - Il nome del giocatore sia centrato sull'asse Y della maglia bambino
   - Il prezzo si aggiorni correttamente per la maglia bambino
   - L'anteprima mostri correttamente la maglia bambino con personalizzazione e add-on
4. Catturare screenshot dell'anteprima

### 4.4 Verifica Trasversale

Durante il cambio maglia, verificare che:

- [ ] La personalizzazione non venga persa durante il cambio
- [ ] I prezzi si aggiornino correttamente per ogni genere
- [ ] La centratura del nome sull'asse Y sia mantenuta per tutte le maglie
- [ ] Non ci siano errori console o problemi di rendering
- [ ] L'anteprima si aggiorni in tempo reale

---

## Fase 5: Verifica Prezzo Finale

### 5.1 Calcolo Prezzo Atteso

1. Leggere il **prezzo base** mostrato al caricamento
2. Leggere i **costi di personalizzazione** direttamente dai pulsanti/etichette
3. Leggere i **costi degli add-on** (patch e sponsor) direttamente dai pulsanti/etichette
4. Calcolare il prezzo atteso dinamicamente:
   ```
   Prezzo Atteso = Prezzo Base + Costo Personalizzazione + Somma Costi Add-On (Patch + Sponsor)
   ```
5. Verificare che il prezzo visualizzato corrisponda al calcolo

### 5.2 Verifica Pulsante "Aggiungi al Carrello"

- Verificare che il totale sia mostrato correttamente nel pulsante "Aggiungi al carrello"
- Verificare che il prezzo nel pulsante corrisponda al prezzo totale calcolato

**NOTA:** i prezzi possono variare, non usare valori hardcoded ma sempre quelli letti dalla pagina

---

## Fase 6: Verifica Anteprima

### 6.1 Controllo Qualità Anteprima

- Controllare che l'anteprima mostri:
  - Nome giocatore (in UPPERCASE)
  - Numero
  - Add-on selezionati (patch e sponsor)
- **Verificare che la scritta (nome) sia centrata sull'asse Y della maglia**
- Verificare che l'anteprima si aggiorni in tempo reale
- Verificare che le immagini dell'anteprima siano di buona qualità
- Verificare che non ci siano elementi sovrapposti o tagliati nell'anteprima

### 6.2 Test Pulsanti Front/Back

- Testare i pulsanti "Front" e "Back" per vedere entrambi i lati della maglia
- Verificare che:
  - Il cambio tra front/back funzioni correttamente
  - La personalizzazione appaia sul lato corretto (nome/numero sul retro, patch e sponsor sul fronte)
  - L'anteprima si aggiorni senza delay

---

## Note Importanti

- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.
- **Catturare screenshot** per ogni verifica visiva importante (centratura nome, add-on applicati, cambio maglia)
- **Leggere sempre i prezzi dinamicamente dalla pagina**, non usare valori hardcoded
- **Verificare la coerenza** tra ciò che l'utente seleziona e ciò che appare nell'anteprima
- **Gli add-on (patch e sponsor) sono opzionali** e la loro disponibilità varia in base alla stagionalità e al tipo di maglia

---
