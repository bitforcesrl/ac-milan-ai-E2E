# PDP Break Testing - Istruzioni

## Obiettivo

**Rompere la personalizzazione della maglia sulla PDP.**

Nessun happy path. Nessun workflow da seguire. Solo tentativi di rompere il sistema in ogni modo possibile.

Pensare come:

- Utente malintenzionato (vuole sfruttare bug)
- Utente confuso (clicca a caso, non capisce il flusso)
- Utente impaziente (clicca veloce, non aspetta caricamenti)
- Utente lento (lascia la pagina aperta, torna dopo minuti)
- Bot (azioni ripetitive, input anomali)

---

## Cosa NON fare

- NON scrivere test Playwright automatizzati
- NON usare codegen
- NON seguire un workflow ordinato
- NON testare il flusso felice (già coperto da altri file)

---

## Riferimenti

Per regole base, monitoring, template bug report → vedere [`.roo/roules/instruction.md`](../.roo/roules/instruction.md).

Questo file contiene SOLO vettori di attacco. Non duplicare checklist, monitoring, o template già presenti altrove.

---

## Vettori di Attacco

### 1. Input Abuse

Provocare il sistema con input anomali nei campi "Tuo Nome":

- **Caratteri speciali:** `<>{}[]|\/~!@#$%^&*()`
- **XSS payloads:** `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`
- **Emoji:** 🎽⚽🏆🥅 (singoli e multipli)
- **Unicode:** caratteri cinesi, arabi, cirillici, zero-width spaces
- **Stringhe lunghissime:** 500+ caratteri, 1000+ caratteri
- **Solo spazi:** `"   "` come nome e numero
- **Newline e tab:** `\n`, `\t` nel campo
- **SQL injection:** `' OR 1=1 --`
- **Copy-paste massivo:** incollare intero paragrafo
- **Drag & drop testo:** trascinare testo da altra pagina nei campi

**Cosa cercare:** crash React, rendering errato, prezzo che cambia, anteprima che esplode, XSS eseguito, carrello con dati corrotti.

---

### 2. Rapid Actions

Azioni veloci per rompere state management:

- **Click spam:** cliccare "Giocatore" 10 volte in 2 secondi
- **Double/triple click:** su "Aggiungi al carrello"
- **Toggle rapido:** Giocatore → Tuo Nome → Giocatore → Tuo Nome (senza pausa)
- **Patch spam:** selezionare/deselezionare patch ripetutamente
- **Size change rapido:** cambiare taglia mentre si seleziona personalizzazione
- **Click durante animazione:** cliccare elementi mentre transizioni CSS in corso
- **Scroll + click:** scrollare velocemente mentre si clicca

**Cosa cercare:** stato inconsistente, prezzo sbagliato, anteprima non aggiornata, doppio prodotto nel carrello, React warnings.

---

### 3. State Manipulation

Manipolare lo stato del browser durante il flusso:

- **Browser back/forward:** dopo aver selezionato personalizzazione, premere back → forward
- **Refresh mid-flow:** F5 mentre si sta aggiungendo al carrello
- **Tab switch:** cambiare tab del browser, tornare dopo 30 secondi
- **Resize viewport:** ridimensionare finestra durante personalizzazione
- **DevTools open:** aprire DevTools durante interazione (può triggerare re-render)
- **Zoom in/out:** Ctrl+scroll durante selezione
- **Offline mode:** disconnettere rete dopo personalizzazione, poi cliccare "Aggiungi al carrello"

**Cosa cercare:** stato perso, prezzo resettato, personalizzazione scomparsa, errore network non gestito, crash componente.

---

### 4. Selection Chaos

Combinazioni di selezione anomale:

- **Nessuna taglia:** provare ad aggiungere al carrello senza selezionare taglia (se possibile)
- **Tutto attivo:** Giocatore + Tuo Nome + Patch contemporaneamente (se UI lo permette)
- **Switch mid-config:** iniziare con Giocatore, selezionare giocatore, poi switchare a Tuo Nome
- **Deselect all:** attivare tutto, poi deselezionare tutto → prezzo torna al base?
- **Patch senza nome:** selezionare solo patch, nessun nome/numero
- **Nome senza numero:** compilare solo nome, lasciare numero vuoto
- **Numero senza nome:** compilare solo numero, lasciare nome vuoto
- **Cambia taglia dopo personalizzazione:** selezionare M, personalizzare, poi cambiare a L

**Cosa cercare:** validazione mancante, prezzo incoerente, anteprima con elementi fantasma, carrello con config incompleta.

---

### 5. Cart Abuse

Attacchi focalizzati sul carrello:

- **Add multiplo stesso config:** cliccare "Aggiungi al carrello" 5 volte con stessa configurazione
- **Add durante loading:** cliccare "Aggiungi" mentre spinner/loading in corso
- **Modify during add:** cambiare personalizzazione ESATTAMENTE mentre si clicca "Aggiungi"
- **Cart overflow:** aggiungere 20+ volte configurazioni diverse
- **Remove + re-add:** rimuovere dal carrello, riaggiungere stessa config
- **Cross-session:** aggiungere al carrello, chiudere tab, riaprire, verificare carrello

**Cosa cercare:** duplicati nel carrello, config sbagliata nel carrello, prezzo totale errato, carrello che non si aggiorna.

---

### 6. Network & DOM

Manipolazione network e DOM:

- **Slow 3G:** throttle network a "Slow 3G" in DevTools, poi interagire
- **Offline mid-action:** disconnettere dopo personalizzazione, prima di aggiungere
- **DOM manipulation:** modificare prezzi/attributi via DevTools Console
- **Remove elements:** cancellare nodi DOM del personalizzatore via Console
- **Inject CSS:** nascondere elementi con `display: none` via Console
- **Force click:** `element.click()` via Console su button disabilitati
- **Modify React state:** accedere a `__reactFiber` e modificare stato interno

**Cosa cercare:** errori non gestiti, UI che non si aggiorna, prezzo manipolabile, crash React.

---

### 7. Edge Cases

Casi limite specifici:

- **Pagina aperta a lungo:** lasciare PDP aperta 10+ minuti, poi interagire
- **Multiple tabs:** aprire stessa PDP in 2 tab, personalizzare in entrambi
- **Concurrent products:** aprire PDP di 2 prodotti diversi, personalizzare entrambi
- **Price race condition:** cambiare personalizzazione velocemente mentre prezzo si aggiorna
- **Preview vs reality:** anteprima mostra X, carrello contiene Y?
- **Mobile viewport:** testare con viewport 320px (iPhone SE)
- **Landscape mobile:** ruotare viewport mobile durante personalizzazione
- **Keyboard navigation:** usare SOLO Tab/Enter/Space per navigare e selezionare
- **Screen reader:** attivare VoiceOver/TalkBack e navigare

**Cosa cercare:** memory leak, race condition, incoerenza anteprima-carrello, UI rotta su mobile, accessibilità mancante.

---

## Cosa Documentare

Per ogni bug trovato, documentare:

1. **Vettore di attacco** (quale categoria sopra)
2. **Azione esatta** (cosa hai fatto)
3. **Risultato atteso** (cosa dovrebbe succedere)
4. **Risultato ottenuto** (cosa è successo)
5. **Severità** (HIGH/MEDIUM/LOW)
6. **Screenshot** (sempre)
7. **Console errors** (se presenti)

Usare template bug report da [`.roo/roules/instruction.md`](../.roo/roules/instruction.md).

---

## Note

- Non seguire ordine. Saltare tra vettori. Combinare attacchi.
- Se qualcosa sembra strano, approfondire.
- Provare lo stesso attacco più volte (bug intermittenti).
- Documentare ANCHE se non si rompe nulla (per sapere cosa è stato testato).
- Focus su PDP. QuickBuy coperto da altro file.
