# Quick Buy - Product Combinations Discovery Test

## Obiettivo

Scoprire e testare tutte le combinazioni di prodotto disponibili nel personalizzatore Quick-Buy della Homepage, verificando che ogni combinazione si carichi correttamente e che l'anteprima si aggiorni in modo appropriato.

---

## Fase 1: Scoperta Dinamica delle Opzioni Disponibili

**IMPORTANTE:** La matrice delle combinazioni varia in base alla stagione e alla disponibilità. Devi scoprire dinamicamente quali opzioni sono disponibili.

**CRITICO - Dipendenza dal Genere:** Le opzioni disponibili per i selettori **Modello** e **Manica** sono DINAMICHE e dipendono dal **Genere** selezionato. NON è sufficiente leggere le opzioni una sola volta all'inizio. Devi seguire questo approccio:

1. **Inizia con un Tipo Maglia** (es. Home)
2. **Seleziona il primo Genere** (es. Uomo)
3. **Scopri le opzioni disponibili** per Modello e Manica con quel Genere specifico
4. **Cambia Genere** (es. Donna) e **rileggi** le opzioni di Modello e Manica - potrebbero essere diverse
5. **Ripeti per ogni Genere** (Bambino) per completare la matrice

Questo significa che la matrice completa si costruisce **iterando attraverso tutti i generi** e scoprendo le opzioni specifiche per ciascuno.

### 1.1 Identificazione Opzioni per Selettore

Per ogni selettore, clicca e annota le opzioni disponibili:

#### Selettore Tipo Maglia

- Clicca sul selettore "Tipo Maglia"
- Annota quali opzioni sono presenti: **Home**, **Away**, **Third** (o solo alcune di queste)
- Documenta le opzioni trovate

#### Selettore Genere

- Clicca sul selettore "Genere"
- Annota quali opzioni sono presenti: **Uomo**, **Donna**, **Bambino**
- Documenta le opzioni trovate

#### Selettore Modello

**ATTENZIONE:** Le opzioni disponibili cambiano in base al Genere selezionato!

- Per ogni Genere (Uomo, Donna, Bambino):
  - Seleziona quel Genere
  - Clicca sul selettore "Modello"
  - Annota quali opzioni sono presenti: **Autentica**, **Replica** (o solo una delle due)
  - Documenta le opzioni trovate per quel Genere specifico

#### Selettore Manica

**ATTENZIONE:** Le opzioni disponibili cambiano in base al Genere selezionato!

- Per ogni Genere (Uomo, Donna, Bambino):
  - Seleziona quel Genere
  - Clicca sul selettore "Manica"
  - Annota quali opzioni sono presenti: **Corta**, **Lunga** (o solo Corta)
  - Documenta le opzioni trovate per quel Genere specifico

### 1.2 Costruzione della Matrice

Combina tutte le opzioni disponibili per creare la lista completa delle combinazioni testabili.

**IMPORTANTE:** Poiché Modello e Manica dipendono dal Genere, la matrice si costruisce **per ogni Genere separatamente**:

**Esempio di approccio corretto:**

1. **Tipo Maglia = Home, Genere = Uomo**
   - Scopri Modello per Uomo: [Autentica, Replica]
   - Scopri Manica per Uomo: [Corta]
   - Combinazioni Uomo: Home × Uomo × Autentica × Corta, Home × Uomo × Replica × Corta

2. **Tipo Maglia = Home, Genere = Donna**
   - Scopri Modello per Donna: [Autentica, Replica] (potrebbe essere diverso!)
   - Scopri Manica per Donna: [Corta, Lunga] (potrebbe essere diverso!)
   - Combinazioni Donna: Home × Donna × Autentica × Corta, Home × Donna × Autentica × Lunga, Home × Donna × Replica × Corta, Home × Donna × Replica × Lunga

3. **Tipo Maglia = Home, Genere = Bambino**
   - Scopri Modello per Bambino: [Replica] (potrebbe essere solo Replica!)
   - Scopri Manica per Bambino: [Corta]
   - Combinazioni Bambino: Home × Bambino × Replica × Corta

4. **Ripeti per Tipo Maglia = Away** con lo stesso approccio

**La matrice finale sarà l'unione di tutte le combinazioni scoperte per ogni Genere.**

**Documenta la matrice completa nel report finale, mostrando chiaramente come le opzioni variano per Genere.**

---

## Fase 2: Test di Ogni Combinazione

Per ogni combinazione della matrice scoperta:

### 2.1 Procedura

1. **Selezionare la combinazione** (Tipo Maglia + Genere + Modello + Manica)
2. **Selezionare la prima taglia disponibile** dal selettore taglie
3. **Verificare che il prodotto si carichi correttamente:**
   - L'anteprima mostri la maglia corretta (colore, design, stemma)
   - Il prezzo base sia visualizzato
   - Non ci siano errori visibili o messaggi di errore
   - Le taglie disponibili siano appropriate per il genere selezionato
4. **Catturare screenshot** dell'anteprima per documentare il risultato
5. **Passare alla combinazione successiva** (NON aggiungere al carrello, NON testare personalizzazioni)

### 2.2 Verifiche per Ogni Combinazione

- [ ] L'anteprima mostra la maglia corretta per la combinazione selezionata
- [ ] Il prezzo base è visualizzato correttamente
- [ ] Non ci sono errori console JavaScript
- [ ] Non ci sono problemi di rendering (elementi sovrapposti, tagliati, sfocati)
- [ ] Le taglie disponibili sono appropriate per il genere (es. taglie diverse per uomo/donna/bambino)
- [ ] Il selettore taglie è funzionante e mostra opzioni valide

### 2.3 Verifica Trasversale

Durante il test di tutte le combinazioni, verificare che:

- [ ] I prezzi si aggiornino correttamente quando si cambia combinazione
- [ ] L'anteprima si aggiorni in tempo reale (non ci siano delay significativi)
- [ ] Non ci siano errori console o network issues (status 4xx/5xx)
- [ ] I pulsanti di selezione mantengono lo stato attivo/inattivo corretto
- [ ] Le immagini dell'anteprima sono di buona qualità per tutte le combinazioni

---

## Fase 3: Documentazione Risultati

### 3.1 Matrice Combinazioni Disponibili

Documentare nel report la matrice completa delle combinazioni scoperte:

```markdown
| Tipo Maglia | Genere | Modello   | Manica | Taglie Disponibili | Prezzo Base |
| ----------- | ------ | --------- | ------ | ------------------ | ----------- |
| Home        | Uomo   | Autentica | Corta  | S, M, L, XL        | €XXX        |
| Home        | Uomo   | Replica   | Corta  | S, M, L, XL        | €XXX        |
| ...         | ...    | ...       | ...    | ...                | ...         |
```

### 3.2 Problemi Trovati

Per ogni problema riscontrato durante il test:

- **Severità:** HIGH/MEDIUM/LOW
- **Descrizione:** Cosa non funziona
- **Combinazione:** Quale combinazione ha causato il problema
- **Screenshot:** Link allo screenshot se disponibile
- **Expected vs Actual:** Cosa ci si aspettava vs cosa è successo

---

## Note Importanti

- **NON testare personalizzazioni** in questo test (verranno testate in un test separato)
- **NON aggiungere al carrello** durante questo test
- **Documentare tutte le opzioni disponibili** per ogni selettore
- **Catturare screenshot** solo se si trovano problemi o anomalie
- **Il nome del giocatore inserito sulla maglia sarà sempre visualizzato in MAIUSCOLO**: questo è il comportamento corretto e desiderato, NON deve essere segnalato come bug.

---
