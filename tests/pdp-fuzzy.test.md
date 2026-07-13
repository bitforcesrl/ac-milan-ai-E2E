# PDP Break Testing - Istruzioni

## Obiettivo

**Rompere la personalizzazione della maglia.**

Nessun happy path. Nessun workflow da seguire. Solo tentativi di rompere il sistema in ogni modo possibile.

Pensare come:

- Utente malintenzionato (vuole sfruttare bug)
- Utente confuso (clicca a caso, non capisce il flusso)
- Utente impaziente (clicca veloce, non aspetta caricamenti)
- Bot (azioni ripetitive, input anomali)

---

## Preparazione Pre-Test

**Prima di iniziare ogni vettore di attacco**, è fondamentale garantire che il carrello sia in uno stato pulito:

1. **Verificare il carrello**: Aprire il carrello e controllare il contenuto
2. **Rimuovere prodotti personalizzati**: Se sono presenti prodotti da test precedenti, rimuoverli completamente
3. **Gestione figurine omaggio**: Il prodotto gratuito "Figurine Omaggio" viene rimosso automaticamente solo quando si rimuove il prodotto personalizzato associato. **Ignorare questo elemento** durante la pulizia del carrello - non deve essere rimosso manualmente
4. **Conferma stato pulito**: Procedere con il test solo quando il carrello è vuoto o contiene esclusivamente le figurine omaggio

**Nota**: Questa fase è critica per evitare che configurazioni residue contaminino i risultati del test corrente.

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

### 3. Selection Chaos

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

### 4. Cart Abuse

Attacchi focalizzati sul carrello:

- **Add multiplo stesso config:** cliccare "Aggiungi al carrello" 5 volte con stessa configurazione
- **Add durante loading:** cliccare "Aggiungi" mentre spinner/loading in corso
- **Modify during add:** cambiare personalizzazione ESATTAMENTE mentre si clicca "Aggiungi"
- **Cart overflow:** aggiungere 20+ volte configurazioni diverse
- **Remove + re-add:** rimuovere dal carrello, riaggiungere stessa config
- **Cross-session:** aggiungere al carrello, chiudere tab, riaprire, verificare carrello

**Cosa cercare:** duplicati nel carrello, config sbagliata nel carrello, prezzo totale errato, carrello che non si aggiorna.

---
