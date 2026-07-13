# Quick Buy - Cart Validation Test

## Obiettivo

Testare il flusso completo di personalizzazione con giocatore random e tutti gli add-on, verificando che il prezzo sia calcolato correttamente e che il prodotto venga aggiunto al carrello con tutti gli attributi corretti.

### Configurazione Base

- **Tipo Maglia:** Home
- **Genere:** Uomo
- **Modello:** Autentica
- **Manica:** Corta
- **Taglia:** Prima taglia disponibile
- **Personalizzazione:** Giocatore (scelto casualmente dal dropdown)

---

## Fase 1: Setup Maglia e Personalizzazione Giocatore

### 1.1 Selezione Configurazione Base

1. Aprire il personalizzatore Quick-Buy
2. Selezionare la combinazione: **Home → Uomo → Autentica → Manica Corta**
3. Selezionare la **prima taglia disponibile**
4. Annotare il **prezzo base** visualizzato

### 1.2 Selezione Giocatore Random

1. Cliccare sul pulsante "Giocatore"
2. **Leggere il costo indicato sul pulsante** (es. "+ €X") e annotarlo
3. Aprire il dropdown dei giocatori
4. **Selezionare casualmente un giocatore** (scegliere un giocatore a caso dalla lista)
5. Verificare che:
   - Il nome e numero appaiano nell'anteprima
   - Il nome sia in UPPERCASE sull'anteprima (comportamento atteso)
   - Il prezzo si aggiorni correttamente (prezzo base + costo personalizzazione)

### 1.3 Documentazione Giocatore Selezionato

Documentare nel report:

- **Nome giocatore (dropdown):** [nome come appare nel dropdown]
- **Nome giocatore (anteprima):** [nome come appare sulla maglia in UPPERCASE]
- **Numero:** [numero assegnato]
- **Costo personalizzazione:** [€X]

---

## Fase 2: Applicazione Tutti gli Add-On

### 2.1 Identificazione Add-On Disponibili

1. **Scorrere la sezione add-on** e identificare tutti gli add-on disponibili:
   - Patch (es. SERIE A, UEFA Champions League, Scudetto, etc.)
   - Sponsor (es. sponsor principale, sponsor manica, etc.)
2. **Annotare la lista completa** degli add-on disponibili
3. **Leggere il costo di ciascun add-on** direttamente dai pulsanti (es. "+ €X")

### 2.2 Applicazione Tutti gli Add-On

1. **Cliccare su tutti gli add-on disponibili** uno per uno
2. Per ogni add-on:
   - Verificare che il pulsante mostri stato attivo
   - Verificare che il prezzo si aggiorni aggiungendo quel costo
   - Verificare che l'add-on appaia nell'anteprima nella posizione corretta
3. Dopo aver applicato tutti gli add-on:
   - **Calcolare il prezzo atteso:**
     ```
     Prezzo Atteso = Prezzo Base + Costo Giocatore + Somma Costi Tutti gli Add-On
     ```
   - Verificare che il prezzo visualizzato corrisponda al calcolo

### 2.3 Documentazione Add-On Applicati

Documentare nel report tutti gli add-on applicati:

| Tipo Add-On | Nome Add-On | Costo | Posizione Anteprima | Stato |
| ----------- | ----------- | ----- | ------------------- | ----- |
| Patch       | [nome]      | €X    | [posizione]         | ✓     |
| Sponsor     | [nome]      | €X    | [posizione]         | ✓     |
| ...         | ...         | ...   | ...                 | ...   |

**Totale add-on applicati:** [numero]
**Costo totale add-on:** [€X]

---

## Fase 3: Verifica Prezzo Finale

### 3.1 Calcolo e Verifica Prezzo

1. Leggere i seguenti valori dalla pagina:
   - **Prezzo base maglia:** [€X]
   - **Costo personalizzazione giocatore:** [€X]
   - **Costo totale add-on:** [€X] (somma di tutti gli add-on)
2. Calcolare il prezzo atteso:
   ```
   Prezzo Atteso = Prezzo Base + Costo Giocatore + Costo Totale Add-On
   ```
3. **Verificare che il prezzo visualizzato** (nel pulsante "Aggiungi al carrello") corrisponda esattamente al calcolo

### 3.2 Screenshot Anteprima Finale

- Catturare screenshot dell'anteprima con:
  - Giocatore selezionato (nome in UPPERCASE + numero)
  - Tutti gli add-on applicati
  - Prezzo finale visibile
- Verificare che:
  - Non ci siano elementi sovrapposti o tagliati
  - La qualità delle immagini sia buona
  - Tutti gli add-on siano visibili e posizionati correttamente

---

## Fase 4: Aggiunta al Carrello e Verifica Attributi

### 4.1 Aggiunta al Carrello

1. Cliccare sul pulsante "Aggiungi al carrello"
2. Attendere che il prodotto venga aggiunto (visualizzare feedback di conferma)
3. Verificare che:
   - Il messaggio di conferma appaia correttamente
   - Il conteggio del carrello si aggiorni (se visibile)
   - Non ci siano errori console o di rete

### 4.2 Navigazione al Carrello

1. Navigare alla pagina del carrello
2. Attendere che il carrello sia completamente caricato

### 4.3 Verifica Line Items del Carrello

Verificare che il prodotto nel carrello abbia **tutti gli attributi corretti**:

#### 4.3.1 Informazioni Prodotto Base

- [ ] **Nome prodotto:** corretto (es. "AC Milan Home Authentic Jersey")
- [ ] **Taglia:** corretta (quella selezionata)
- [ ] **Prezzo unitario:** corrisponde al prezzo totale calcolato (base + giocatore + add-on)
- [ ] **Quantità:** 1

#### 4.3.2 Attributi Personalizzazione

Verificare che siano presenti gli attributi di personalizzazione nei line items:

- [ ] **Tipo personalizzazione:** "Giocatore" (o equivalente)
- [ ] **Nome giocatore:** corretto (quello selezionato dal dropdown)
- [ ] **Numero giocatore:** corretto (quello assegnato automaticamente)

#### 4.3.3 Attributi Add-On

Verificare che tutti gli add-on applicati siano presenti negli attributi:

- [ ] **Lista add-on:** tutti gli add-on applicati sono presenti
- [ ] **Nomi add-on:** corretti (es. "SERIE A", "UEFA Champions League", etc.)
- [ ] **Costi add-on:** se visibili, corrispondono ai costi letti durante il test

#### 4.3.4 Verifica Totale Carrello

- [ ] **Subtotale:** corrisponde al prezzo del prodotto
- [ ] **Totale carrello:** corrisponde al subtotale (se non ci sono altri prodotti)
- [ ] **Valuta:** corretta (EUR)

#### 4.3.5 Lettura Attributi Nascosti dei Line Items

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

### 4.4 Screenshot Carrello

- Catturare screenshot del carrello che mostri:
  - Il prodotto con tutti gli attributi
  - Il prezzo corretto
  - Gli attributi di personalizzazione (giocatore, numero)
  - Gli attributi degli add-on

---

## Fase 5: Verifica Coerenza Complessiva

### 5.1 Check Finale

Verificare che:

- [ ] Il prezzo nel carrello corrisponda al prezzo calcolato durante il test
- [ ] Tutti gli attributi di personalizzazione siano presenti e corretti
- [ ] Tutti gli add-on siano elencati negli attributi del line item
- [ ] Non ci siano discrepanze tra ciò che è stato selezionato e ciò che appare nel carrello
- [ ] Non ci siano errori console JavaScript
- [ ] Non ci siano richieste HTTP fallite (4xx, 5xx)

### 5.2 Documentazione Prezzi

Documentare nel report il breakdown completo dei prezzi:

```
Prezzo Base Maglia:           €XXX
+ Costo Personalizzazione:    €XX (Giocatore)
+ Costo Add-On 1:             €XX (nome add-on)
+ Costo Add-On 2:             €XX (nome add-on)
+ Costo Add-On N:             €XX (nome add-on)
────────────────────────────────────
Totale Calcolato:             €XXX
Totale Visualizzato:          €XXX
Totale nel Carrello:          €XXX
```

**Verifica:** [✓] Tutti i totali corrispondono / [✗] Discrepanza rilevata

---

## Note Importanti

- **Il nome del giocatore sulla maglia sarà sempre in MAIUSCOLO**: comportamento atteso, NON segnalare come bug
- **Leggere sempre i prezzi dinamicamente dalla pagina**, non usare valori hardcoded
- **Catturare screenshot** per ogni fase importante (anteprima finale, carrello con attributi)
- **Verificare la coerenza** tra selezione utente e attributi nel carrello
- **Gli add-on sono opzionali** e la loro disponibilità varia in base alla stagionalità
