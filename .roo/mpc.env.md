Ecco la guida completa e formattata in Markdown con tutti i nomi dei dispositivi ufficiali pronti per essere copiati e incollati nel tuo file di configurazione o nel file `.env`.

---

## 📱 Guida ai Dispositivi per `PLAYWRIGHT_MCP_DEVICE`

Per configurare l'emulazione mobile, inserisci una delle stringhe seguenti nel tuo file `.env` associandola alla variabile dedicata:

```env
PLAYWRIGHT_MCP_DEVICE="Nome Dispositivo"

```

Se il device che vuoi emulare non è presente nella lista, puoi lasciare la variabile vuota e definire manualmente le dimensioni della finestra del browser con la variabile `PLAYWRIGHT_MCP_VIEWPORT_SIZE`.

PLAYWRIGHT_MCP_DEVICE=""
PLAYWRIGHT_MCP_VIEWPORT_SIZE="412x960"

---

### 🍏 Smartphone Apple (iOS)

| Stringa da usare in `.env` | Dispositivo Emulato | Risoluzione Nativa (px) |
| -------------------------- | ------------------- | ----------------------- |
| `iPhone 12`                | iPhone 12 / 12 Pro  | 390 x 844               |
| `iPhone 12 Mini`           | iPhone 12 Mini      | 360 x 780               |
| `iPhone 12 Pro Max`        | iPhone 12 Pro Max   | 428 x 926               |
| `iPhone 13`                | iPhone 13 / 13 Pro  | 390 x 844               |
| `iPhone 13 Mini`           | iPhone 13 Mini      | 360 x 780               |
| `iPhone 13 Pro Max`        | iPhone 13 Pro Max   | 428 x 926               |
| `iPhone 14`                | iPhone 14           | 390 x 844               |
| `iPhone 14 Pro`            | iPhone 14 Pro       | 393 x 852               |
| `iPhone 14 Pro Max`        | iPhone 14 Pro Max   | 430 x 932               |
| `iPhone 15`                | iPhone 15           | 393 x 852               |
| `iPhone 15 Pro`            | iPhone 15 Pro       | 393 x 852               |
| `iPhone 15 Pro Max`        | iPhone 15 Pro Max   | 430 x 932               |

---

### 🤖 Smartphone Android

| Stringa da usare in `.env` | Dispositivo Emulato | Risoluzione Nativa (px) |
| -------------------------- | ------------------- | ----------------------- |
| `Pixel 5`                  | Google Pixel 5      | 393 x 851               |
| `Pixel 7`                  | Google Pixel 7      | 412 x 915               |
| `Galaxy S22`               | Samsung Galaxy S22  | 360 x 780               |
| `Galaxy S24`               | Samsung Galaxy S24  | 360 x 780               |

---

### 平板 Tablet (iPad & Android)

| Stringa da usare in `.env` | Dispositivo Emulato       | Risoluzione Nativa (px) |
| -------------------------- | ------------------------- | ----------------------- |
| `iPad Mini`                | Apple iPad Mini           | 768 x 1024              |
| `iPad (gen 6)`             | Apple iPad 6a Generazione | 768 x 1024              |
| `iPad (gen 7)`             | Apple iPad 7a Generazione | 810 x 1080              |
| `iPad Pro 11`              | Apple iPad Pro 11"        | 834 x 1194              |
| `Galaxy Tab S4`            | Samsung Galaxy Tab S4     | 712 x 1138              |

---

## 🔄 Modificatori Speciali

### Orientamento Orizzontale (Landscape)

Di default, Playwright avvia tutti i dispositivi in modalità verticale (_portrait_). Se vuoi forzare l'IA a navigare vedendo il sito in modalità orizzontale, aggiungi semplicemente la parola **`landscape`** dopo il nome del dispositivo.

> **Esempi pratici da mettere nel `.env`:**
>
> - `PLAYWRIGHT_MCP_DEVICE="iPhone 15 Pro Max landscape"`
> - `PLAYWRIGHT_MCP_DEVICE="iPad Pro 11 landscape"`
