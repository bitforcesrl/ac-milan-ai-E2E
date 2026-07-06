# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdp-personalization.spec.js >> PDP Personalization & Cart Bug Hunt >> PDP-002: Size selection via popover
- Location: tests/pdp-personalization.spec.js:128:3

# Error details

```
Error: locator.click: Element is outside of the viewport
Call log:
  - waiting for locator('.Popover__Value[data-option-type=\'size\']').nth(1)
    - locator resolved to <button type="button" data-value="S" data-option-type="size" data-option-position="1" data-action="select-value" class="Popover__Value Heading Link Link--primary u-h6">S</button>
  - attempting click action
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - img [ref=e2]
  - link "Vai al contenuto" [ref=e3] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "Scopri ora il nuovo Kit Home 2026/27" [ref=e9] [cursor=pointer]:
        - /url: /pages/home-kit-2026-27
        - paragraph [ref=e10]:
          - text: Scopri ora il nuovo
          - strong [ref=e11]: Kit Home 2026/27
      - generic [ref=e15]:
        - 'link "Saldi di fine stagione: fino al 60% di sconto"':
          - /url: /collections/sales
        - paragraph [ref=e16]:
          - 'link "Saldi di fine stagione: fino al 60% di sconto"':
            - /url: /collections/sales
          - link "Saldi di fine stagione" [ref=e17] [cursor=pointer]:
            - /url: /collections/sales
            - strong [ref=e18]: Saldi di fine stagione
          - text: ": fino al"
          - strong [ref=e19]: 60% di sconto
      - link "Iscriviti a Rossoneri Rewards ed entra a far parte della community rossonera!" [ref=e23] [cursor=pointer]:
        - /url: /pages/rossoneri-rewards
        - paragraph [ref=e24]:
          - text: Iscriviti a
          - strong [ref=e25]: Rossoneri Rewards
          - text: ed entra a far parte della community rossonera!
    - banner [ref=e27]:
      - generic [ref=e28]:
        - navigation "Navigazione principale" [ref=e30]:
          - list [ref=e31]:
            - listitem [ref=e32]:
              - link "Kit Gara Kit Gara" [ref=e33] [cursor=pointer]:
                - /url: /collections/milan-match-kit
                - text: Kit Gara
                - generic: Kit Gara
            - listitem [ref=e34]:
              - button "Shop By Player Shop By Player" [ref=e35] [cursor=pointer]:
                - text: Shop By Player
                - generic: Shop By Player
            - listitem [ref=e36]:
              - link "Allenamento Allenamento" [ref=e37] [cursor=pointer]:
                - /url: /collections/apparel-milan-training
                - text: Allenamento
                - generic: Allenamento
            - listitem [ref=e38]:
              - link "Abbigliamento Abbigliamento" [ref=e39] [cursor=pointer]:
                - /url: /collections/apparel-milan
                - text: Abbigliamento
                - generic: Abbigliamento
            - listitem [ref=e40]:
              - link "Accessori Accessori" [ref=e41] [cursor=pointer]:
                - /url: /collections/milan-accessories-gift-guide-gadgets
                - text: Accessori
                - generic: Accessori
            - listitem [ref=e42]:
              - link "RETRO RETRO" [ref=e43] [cursor=pointer]:
                - /url: /collections/retro-jerseys-milan-man
                - text: RETRO
                - generic: RETRO
            - listitem [ref=e44]:
              - link "Collezioni Collezioni" [ref=e45] [cursor=pointer]:
                - /url: /pages/collection-timeline
                - text: Collezioni
                - generic: Collezioni
            - listitem [ref=e46]:
              - link "SALDI SALDI" [ref=e47] [cursor=pointer]:
                - /url: /collections/sales
                - text: SALDI
                - generic: SALDI
            - listitem [ref=e48]:
              - link "community community" [ref=e49] [cursor=pointer]:
                - /url: /pages/rossoneri-rewards
                - text: community
                - generic: community
        - link "AC Milan Store" [ref=e52] [cursor=pointer]:
          - /url: /
          - img "AC Milan Store" [ref=e53]
        - generic [ref=e54]:
          - link "Ricerca" [ref=e55] [cursor=pointer]:
            - /url: /search
          - link "Wishlist" [ref=e57] [cursor=pointer]:
            - /url: /apps/iwish
          - link "Account" [ref=e58] [cursor=pointer]:
            - /url: https://identity.acmilan.com/identity/services/oauth2/authorize/expid_itecomm?client_id=3MVG9fTLmJ60pJ5KiKCzxM1KcWAfsj9rNJzT09kthJStTbxmHrmPrIuvyyV.lXWaQKXLqQVfzX0slQZ7hhgaK&redirect_uri=https%3A%2f%2facmilancustomerintegrationprod.azurewebsites.net%2fapi%2foauth2&response_type=code&state=https%3A%2F%2Fstore.acmilan.com%2Fproducts%2Facm-home-authentic-jersey
          - link "Rossoneri Rewards" [ref=e59] [cursor=pointer]:
            - /url: /pages/rossoneri-rewards
            - img
          - link "Apri il carrello" [ref=e60] [cursor=pointer]:
            - /url: /cart
    - main [ref=e62]:
      - generic [ref=e64]:
        - generic [ref=e65]:
          - generic [ref=e66]:
            - generic [ref=e69]:
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e78]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e81]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e84]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e87]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e90]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e93]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e96]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e99]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e102]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e105]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e108]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e111]
              - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e114]
            - generic [ref=e116]:
              - generic [ref=e118]:
                - link [ref=e119] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_01.jpg?v=1779429459&width=1024
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e124] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_01_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e125]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e126] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_02_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e127]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e128] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_03_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e129]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e130] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_04_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e131]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e132] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_05_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e133]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e134] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_06_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e135]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e136] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_07_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e137]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e138] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_08_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e139]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e140] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_09_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e141]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e142] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_10_1024x.jpg?v=1779429459
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e143]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e144] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_11_22247a75-5d06-4f2d-930f-c173030992de_1024x.jpg?v=1779429522
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e145]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e146] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_12_f55a6dcb-7234-49c3-aa80-67ea198cf823_1024x.jpg?v=1779429522
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e147]
                - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e148] [cursor=pointer]:
                  - /url: //store.acmilan.com/cdn/shop/files/784120-A82_13_11f8910b-b1ea-4584-91ea-bedfef9b95f8_1024x.jpg?v=1779429522
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [ref=e149]
              - button "previous" [disabled] [ref=e150]:
                - img [ref=e151]
              - button "next" [ref=e153] [cursor=pointer]:
                - img [ref=e154]
          - generic [ref=e158]:
            - generic [ref=e159]:
              - generic [ref=e160]:
                - generic [ref=e163]:
                  - generic:
                    - img
                  - generic: Personalizzazione
                - text: Puma
                - heading "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27" [level=1] [ref=e164]
              - generic [ref=e169]: 150,00 €
              - generic [ref=e170]:
                - generic [ref=e176]: Ottieni 150 punti per questo prodotto con Rossoneri Rewards.
                - link "Accedi o Registrati" [ref=e178] [cursor=pointer]:
                  - /url: https://store.acmilan.com/pages/rossoneri-rewards
              - generic [ref=e180]:
                - generic [ref=e181]:
                  - text: Scegli la taglia
                  - button "Tabella misure" [ref=e182] [cursor=pointer]
                - list [ref=e183]:
                  - listitem [ref=e184]:
                    - generic [ref=e187] [cursor=pointer]: XS
                  - listitem [ref=e188]:
                    - generic [ref=e191] [cursor=pointer]: S
                  - listitem [ref=e192]:
                    - generic [ref=e195] [cursor=pointer]: M
                  - listitem [ref=e196]:
                    - generic [ref=e199] [cursor=pointer]: L
                  - listitem [ref=e200]:
                    - generic [ref=e203] [cursor=pointer]: XL
                  - listitem [ref=e204]:
                    - generic [ref=e207] [cursor=pointer]: XXL
              - generic [ref=e210]:
                - paragraph [ref=e211]: Personalizza
                - generic [ref=e213]:
                  - generic [ref=e215]:
                    - paragraph [ref=e217]: Nome e Numero
                    - generic [ref=e218]:
                      - button "customization.form.deselect" [ref=e219] [cursor=pointer]:
                        - img [ref=e221]
                      - generic [ref=e224]:
                        - button "Giocatore (+ €15)" [ref=e225] [cursor=pointer]:
                          - generic [ref=e227]:
                            - text: Giocatore
                            - generic [ref=e228]: (+ €15)
                        - button "Tuo Nome (+ €18)" [ref=e229] [cursor=pointer]:
                          - generic [ref=e231]:
                            - text: Tuo Nome
                            - generic [ref=e232]: (+ €18)
                  - generic [ref=e233]:
                    - paragraph [ref=e235]: Patch
                    - generic [ref=e236]:
                      - button "customization.form.deselect" [ref=e237] [cursor=pointer]:
                        - img [ref=e239]
                      - button "SERIE A (+ €12)" [ref=e243] [cursor=pointer]:
                        - generic [ref=e245]:
                          - text: SERIE A
                          - generic [ref=e246]: (+ €12)
                - generic [ref=e247]:
                  - generic [ref=e248]: Non si effettuano resi per i prodotti personalizzati.
                  - button "Aggiungi al carrello" [ref=e250] [cursor=pointer]:
                    - generic [ref=e252]: Aggiungi al carrello
              - generic [ref=e253]:
                - generic [ref=e254]: Aggiungi alla wishlist
                - link "Aggiungi alla wishlist" [ref=e256] [cursor=pointer]:
                  - /url: "#"
                  - img
              - generic [ref=e257]:
                - generic [ref=e258]: "Condividi:"
                - generic [ref=e259]:
                  - link "Facebook" [ref=e260] [cursor=pointer]:
                    - /url: https://www.facebook.com/sharer.php?u=https://store.acmilan.com/products/acm-home-authentic-jersey
                    - img
                  - link "Twitter" [ref=e261] [cursor=pointer]:
                    - /url: https://twitter.com/share?text=MAGLIA MILAN GARA HOME AUTHENTIC 2026/27&url=https://store.acmilan.com/products/acm-home-authentic-jersey
                  - link "Pinterest" [ref=e262] [cursor=pointer]:
                    - /url: https://pinterest.com/pin/create/button/?url=https://store.acmilan.com/products/acm-home-authentic-jersey&media=https://store.acmilan.com/cdn/shop/files/784120-A82_01_large.jpg?v=1779429459&description=Ci%20sono%20molti%20modi%20per%20dire%20%22ti%20amo%22.%20A%20volte%20basta%20una%20maglia.%20Il%20Kit...
            - generic [ref=e263]:
              - generic [ref=e265]:
                - img
                - text: Completa il look
              - generic [ref=e267]:
                - link "PANTALONCINI BIANCHI MILAN GARA HOME 2026/27" [ref=e269] [cursor=pointer]:
                  - /url: /products/acm-shorts-replica-784149-b50
                  - img "PANTALONCINI BIANCHI MILAN GARA HOME 2026/27" [ref=e271]
                - generic [ref=e272]:
                  - heading "PANTALONCINI BIANCHI MILAN GARA HOME 2026/27" [level=3] [ref=e273]:
                    - link "PANTALONCINI BIANCHI MILAN GARA HOME 2026/27" [ref=e274] [cursor=pointer]:
                      - /url: /products/acm-shorts-replica-784149-b50
                  - generic [ref=e276]: €45,00
                - generic [ref=e277]:
                  - generic [ref=e278]:
                    - button "Taglia" [expanded] [ref=e281] [cursor=pointer]:
                      - generic [ref=e283]: Taglia
                    - link "Personalizza" [ref=e284] [cursor=pointer]:
                      - /url: /products/acm-shorts-replica-784149-b50
                  - button "Aggiungi" [ref=e286] [cursor=pointer]:
                    - generic [ref=e287]: Aggiungi
              - generic [ref=e289]:
                - link "PANTALONCINI NERI MILAN GARA HOME 2026/27" [ref=e291] [cursor=pointer]:
                  - /url: /products/acm-shorts-replica-784149-a82
                  - img "PANTALONCINI NERI MILAN GARA HOME 2026/27" [ref=e293]
                - generic [ref=e294]:
                  - heading "PANTALONCINI NERI MILAN GARA HOME 2026/27" [level=3] [ref=e295]:
                    - link "PANTALONCINI NERI MILAN GARA HOME 2026/27" [ref=e296] [cursor=pointer]:
                      - /url: /products/acm-shorts-replica-784149-a82
                  - generic [ref=e298]: €45,00
                - generic [ref=e299]:
                  - generic [ref=e300]:
                    - button "Taglia" [ref=e303] [cursor=pointer]:
                      - generic [ref=e305]: Taglia
                    - link "Personalizza" [ref=e306] [cursor=pointer]:
                      - /url: /products/acm-shorts-replica-784149-a82
                  - button "Aggiungi" [ref=e308] [cursor=pointer]:
                    - generic [ref=e309]: Aggiungi
              - generic [ref=e311]:
                - link "CALZETTONI MILAN GARA HOME 2026/27" [ref=e313] [cursor=pointer]:
                  - /url: /products/acm-striped-socks-replica
                  - img "CALZETTONI MILAN GARA HOME 2026/27" [ref=e315]
                - generic [ref=e316]:
                  - heading "CALZETTONI MILAN GARA HOME 2026/27" [level=3] [ref=e317]:
                    - link "CALZETTONI MILAN GARA HOME 2026/27" [ref=e318] [cursor=pointer]:
                      - /url: /products/acm-striped-socks-replica
                  - generic [ref=e320]: €23,00
                - generic [ref=e321]:
                  - button "Taglia" [ref=e325] [cursor=pointer]:
                    - generic [ref=e327]: Taglia
                  - button "Aggiungi" [ref=e329] [cursor=pointer]:
                    - generic [ref=e330]: Aggiungi
          - generic [ref=e332]:
            - generic [ref=e333]:
              - heading "Descrizione" [level=2] [ref=e335] [cursor=pointer]
              - generic [ref=e336]:
                - paragraph [ref=e337]:
                  - text: Ci sono molti modi per dire "ti amo". A volte basta una maglia.
                  - text: Il Kit Home 26/27 riporta in vita le strisce rossonere spesse e, con esse, l'estetica senza tempo che ha fatto innamorare milioni di tifosi dell'AC Milan.
                  - text: Nel colletto si nasconde una lettera d'amore dedicata a ogni supporter.
                  - text: "Sul retro del collo, un sigillo che rende tutto ufficiale: l'amore più bello in rossonero."
                - paragraph [ref=e338]: Emirates™ Principal Partner e Official Airline Partner e MSC Sleeve Partner.
                - paragraph [ref=e339]: La versione Authentic della maglia la stessa indossata dai giocatori in campo. Presenta il tessuto ULTRAWEAVE di PUMA e una vestibilità atletica, progettata per prestazioni di livello élite.
                - paragraph [ref=e340]:
                  - text: "LEGGEREZZA: L'unica cosa che dovresti sentire? Velocità. ULTRAWEAVE il tessuto performance ultra-leggero di PUMA, realizzato con una tessitura di precisione per garantire libertà di movimento e prestazioni senza distrazioni."
                  - text: "COMFORT: le tecnologie dryCELL e ThermoAdapt sono progettate per assorbire il sudore e regolare la temperatura, mantenendoti asciutto e confortevole."
                  - text: "MATERIALI RICICLATI: Realizzata con almeno il 50% di materiali riciclati."
                - paragraph [ref=e341]:
                  - text: DETTAGLI
                  - text: "- Tessuto elasticizzato realizzato con materiali riciclati per ridurre gli sprechi e per un futuro più sostenibile"
                  - text: "- Patch logo ufficiale AC Milan applicata sul petto a sinistra, con stellina ricamata"
                  - text: "- Logo Principal Partner Emirates™ stampato davanti"
                  - text: "- Logo Sleeve Partner MSC stampato sulla manica sinistra"
                  - text: "- Logo Puma ricamato sul petto a destra e sulle spalle"
                  - text: "- Patch personalizzabili"
                  - text: "- Vestibilità regolare"
                  - text: "- Marchio di autenticità Puma sul fondo a destra"
                  - text: "- Sigillo in cera lacca oro in rilievo sul retro del collo"
                - paragraph [ref=e342]:
                  - text: MATERIALI E CURA
                  - text: "- Materiale esterno: 50% elastomultiester, 50% poliestere riciclato"
                  - text: "- Dettagli: 100% poliestere"
                  - text: "- Seguire sempre le istruzioni per la cura del capo riportate sull'etichetta interna"
                - paragraph [ref=e343]:
                  - emphasis [ref=e344]: La maglia gara 2026/27 rispetta le caratteristiche di personalizzazione, patch e sponsor del Campionato Serie A 2025/26. Tali elementi potrebbero subire variazioni nel corso della stagione. Non siamo responsabili per eventuali modifiche alla rosa ufficiale dei giocatori, al design delle patch o agli sponsor per la stagione 2026/27.
              - button "Mostra di più" [ref=e345] [cursor=pointer]:
                - generic [ref=e346]: Mostra di più
            - button "Spedizioni e resi" [ref=e348] [cursor=pointer]:
              - heading "Spedizioni e resi" [level=2] [ref=e349]: Spedizioni e resi
        - generic [ref=e353]:
          - button "S" [ref=e354] [cursor=pointer]
          - button "M" [ref=e355] [cursor=pointer]
          - button "L" [ref=e356] [cursor=pointer]
          - button "XL" [ref=e357] [cursor=pointer]
          - button "XXL" [ref=e358] [cursor=pointer]
      - generic [ref=e360]:
        - generic [ref=e363]: Potrebbe anche piacerti
        - generic [ref=e366]:
          - generic [ref=e368]:
            - generic [ref=e371]:
              - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 A MANICHE LUNGHE" [ref=e373] [cursor=pointer]:
                - /url: /products/acm-home-jersey-auth?pr_prod_strat=e5_desc&pr_rec_id=f11a3c28e&pr_rec_pid=15882194354549&pr_ref_pid=15878867878261&pr_seq=uniform
                - generic [ref=e374]:
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 A MANICHE LUNGHE" [ref=e375]
                  - img "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 A MANICHE LUNGHE" [ref=e376]
              - generic [ref=e379] [cursor=pointer]:
                - generic:
                  - img
                - generic: Personalizzazione
              - generic [ref=e380]:
                - heading "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 A MANICHE LUNGHE" [level=3] [ref=e381]:
                  - link "MAGLIA MILAN GARA HOME AUTHENTIC 2026/27 A MANICHE LUNGHE" [ref=e382] [cursor=pointer]:
                    - /url: /products/acm-home-jersey-auth?pr_prod_strat=e5_desc&pr_rec_id=f11a3c28e&pr_rec_pid=15882194354549&pr_ref_pid=15878867878261&pr_seq=uniform
                - generic [ref=e384]: €160,00
            - generic [ref=e387]:
              - link "MAGLIA MILAN GARA HOME 2026/27" [ref=e389] [cursor=pointer]:
                - /url: /products/acm-home-jersey-replica-784121-a82?pr_prod_strat=e5_desc&pr_rec_id=f11a3c28e&pr_rec_pid=15882194714997&pr_ref_pid=15878867878261&pr_seq=uniform
                - generic [ref=e390]:
                  - img "MAGLIA MILAN GARA HOME 2026/27" [ref=e391]
                  - img "MAGLIA MILAN GARA HOME 2026/27" [ref=e392]
              - generic [ref=e395] [cursor=pointer]:
                - generic:
                  - img
                - generic: Personalizzazione
              - generic [ref=e396]:
                - heading "MAGLIA MILAN GARA HOME 2026/27" [level=3] [ref=e397]:
                  - link "MAGLIA MILAN GARA HOME 2026/27" [ref=e398] [cursor=pointer]:
                    - /url: /products/acm-home-jersey-replica-784121-a82?pr_prod_strat=e5_desc&pr_rec_id=f11a3c28e&pr_rec_pid=15882194714997&pr_ref_pid=15878867878261&pr_seq=uniform
                - generic [ref=e400]: €100,00
          - button "previous" [disabled] [ref=e401]:
            - img [ref=e402]
          - button "next" [disabled] [ref=e404]:
            - img [ref=e405]
    - contentinfo [ref=e408]:
      - generic [ref=e409]:
        - generic [ref=e410]: "#alwaysmilan"
        - img "#alwaysmilan" [ref=e411]
        - generic [ref=e412]: "#sempremilan"
      - generic [ref=e413]:
        - generic [ref=e414]:
          - generic [ref=e415]:
            - paragraph [ref=e416]: AC Milan
            - generic [ref=e417]:
              - paragraph [ref=e418]:
                - text: Benvenuto nello Store Ufficiale di
                - strong [ref=e419]: AC Milan
                - text: ", il posto perfetto per la tua passione rossonera. Qui potrai acquistare in maniera sicura, rapida e facile i tuoi prodotti preferiti: scopri i Kit gara Puma, i prodotti d’abbigliamento, le Capsule Collection e un vasto assortimento di accessori e idee regalo."
              - paragraph [ref=e420]: Supporta la tua squadra acquistando i prodotti ufficiali, mostra con orgoglio l’amore per i colori rossoneri.
              - paragraph [ref=e421]: "#SempreMilan"
            - list [ref=e422]:
              - listitem [ref=e423]:
                - link "Twitch" [ref=e424] [cursor=pointer]:
                  - /url: https://www.twitch.tv/acmilan
              - listitem [ref=e426]:
                - link "Facebook" [ref=e427] [cursor=pointer]:
                  - /url: https://www.facebook.com/ACMilan/
                  - generic [ref=e428]:
                    - img
              - listitem [ref=e429]:
                - link "Instagram" [ref=e430] [cursor=pointer]:
                  - /url: https://www.instagram.com/acmilan/
              - listitem [ref=e432]:
                - link "TikTok" [ref=e433] [cursor=pointer]:
                  - /url: https://www.tiktok.com/@acmilan
              - listitem [ref=e435]:
                - link "YouTube" [ref=e436] [cursor=pointer]:
                  - /url: https://www.youtube.com/channel/UCKcx1uK38H4AOkmfv4ywlrg
              - listitem [ref=e438]:
                - link "Twitter" [ref=e439] [cursor=pointer]:
                  - /url: https://twitter.com/acmilan
              - listitem [ref=e441]:
                - link "Apple music" [ref=e442] [cursor=pointer]:
                  - /url: https://music.apple.com/it/curator/ac-milan/1532222210
          - generic [ref=e445]:
            - button "Acquisti" [ref=e446] [cursor=pointer]:
              - paragraph [ref=e447]: Acquisti
            - list [ref=e450]:
              - listitem [ref=e451]:
                - link "Acquisto" [ref=e452] [cursor=pointer]:
                  - /url: /pages/purchase
              - listitem [ref=e453]:
                - link "Metodi di Pagamento" [ref=e454] [cursor=pointer]:
                  - /url: /pages/payment-methods
              - listitem [ref=e455]:
                - link "Spedizioni" [ref=e456] [cursor=pointer]:
                  - /url: /pages/shipping-and-returns
          - generic [ref=e458]:
            - button "Aiuto" [ref=e459] [cursor=pointer]:
              - paragraph [ref=e460]: Aiuto
            - list [ref=e463]:
              - listitem [ref=e464]:
                - link "Registrazione" [ref=e465] [cursor=pointer]:
                  - /url: /pages/registration
              - listitem [ref=e466]:
                - link "Richiedi reso" [ref=e467] [cursor=pointer]:
                  - /url: /pages/returns
              - listitem [ref=e468]:
                - link "Help Center" [ref=e469] [cursor=pointer]:
                  - /url: https://help.acmilan.com/it/shop-online
          - generic [ref=e471]:
            - button "Informazioni" [ref=e472] [cursor=pointer]:
              - paragraph [ref=e473]: Informazioni
            - list [ref=e476]:
              - listitem [ref=e477]:
                - link "Chi siamo" [ref=e478] [cursor=pointer]:
                  - /url: /pages/about-us
              - listitem [ref=e479]:
                - link "Milan Flagship Store Via Dante" [ref=e480] [cursor=pointer]:
                  - /url: /pages/store-ac-milan
              - listitem [ref=e481]:
                - link "La Bottega del Diavolo" [ref=e482] [cursor=pointer]:
                  - /url: /pages/la-bottega-del-diavolo
              - listitem [ref=e483]:
                - link "Milan Store San Babila" [ref=e484] [cursor=pointer]:
                  - /url: /pages/milan-store-san-babila
              - listitem [ref=e485]:
                - link "Milan Store Casa Milan" [ref=e486] [cursor=pointer]:
                  - /url: /pages/milan-store-casa-milan
              - listitem [ref=e487]:
                - link "Milan Store Malpensa" [ref=e488] [cursor=pointer]:
                  - /url: /pages/milan-store-malpensa
              - listitem [ref=e489]:
                - link "Milan Store San Siro" [ref=e490] [cursor=pointer]:
                  - /url: /pages/milan-store-san-siro
              - listitem [ref=e491]:
                - link "CRN Card" [ref=e492] [cursor=pointer]:
                  - /url: /pages/crn-card
              - listitem [ref=e493]:
                - link "Termini e Condizioni" [ref=e494] [cursor=pointer]:
                  - /url: /pages/terms-conditions
              - listitem [ref=e495]:
                - link "Termini e Condizioni Rossoneri Rewards" [ref=e496] [cursor=pointer]:
                  - /url: /pages/termini-e-condizioni-rossoneri-rewards
              - listitem [ref=e497]:
                - link "Privacy" [ref=e498] [cursor=pointer]:
                  - /url: /pages/privacy-policy
              - listitem [ref=e499]:
                - link "Cookie Policy" [ref=e500] [cursor=pointer]:
                  - /url: https://www.acmilan.com/it/cookie-management-policy
              - listitem [ref=e501]:
                - link "Accessibilità" [ref=e502] [cursor=pointer]:
                  - /url: /pages/accessibility
          - generic [ref=e503]:
            - paragraph [ref=e504]: Newsletter
            - paragraph [ref=e506]: Iscriviti e rimani aggiornato sui lanci esclusivi, offerte speciali e le nostre ultime novità
            - region "Store Newsletter_IT" [ref=e508]:
              - generic [ref=e510]:
                - generic [ref=e512]:
                  - generic [ref=e513]:
                    - generic [ref=e514]: Email*
                    - textbox "Email*" [ref=e517]:
                      - /placeholder: inserisci il tuo indirizzo email
                  - paragraph [ref=e520]:
                    - link "Informativa privacy" [ref=e522] [cursor=pointer]:
                      - /url: https://store.acmilan.com/pages/privacy-policy
                  - group "Mailing list campo obbligatorio" [ref=e524]:
                    - generic [ref=e525]: Mailing list campo obbligatorio
                    - generic [ref=e527]:
                      - checkbox "Ho letto l’informativa privacy" [ref=e528]
                      - generic [ref=e529]: Ho letto l’informativa privacy
                - region "Form actions" [ref=e531]:
                  - navigation "Form navigation" [ref=e532]:
                    - button "Iscrivimi" [ref=e533] [cursor=pointer]
        - generic [ref=e535]:
          - generic [ref=e537]:
            - generic [ref=e538]:
              - generic [ref=e539]: Paese/Area geografica
              - button "IT - EUR €" [ref=e540] [cursor=pointer]: IT - EUR €
            - generic [ref=e541]:
              - generic [ref=e542]: Lingua
              - button "Italiano" [ref=e543] [cursor=pointer]: Italiano
          - link "© AC Milan Store" [ref=e545] [cursor=pointer]:
            - /url: /
          - list [ref=e546]:
            - listitem [ref=e547]:
              - img "American Express" [ref=e548]
            - listitem [ref=e553]:
              - img "Apple Pay" [ref=e554]
            - listitem [ref=e565]:
              - img "Google Pay" [ref=e566]
            - listitem [ref=e574]:
              - img "Maestro" [ref=e575]
            - listitem [ref=e581]:
              - img "Mastercard" [ref=e582]
            - listitem [ref=e589]:
              - img "PayPal" [ref=e590]
            - listitem [ref=e596]:
              - img "Union Pay" [ref=e597]
            - listitem [ref=e603]:
              - img "Visa" [ref=e604]
            - listitem [ref=e609]:
              - img "Klarna"
  - alert [ref=e610]
```

# Test source

```ts
  85  |   const PRICE_SEL = ".price, .product-price, [class*='price']";
  86  | 
  87  |   test("PDP-001: Page loads and personalization sections are present", async ({
  88  |     page,
  89  |   }) => {
  90  |     const title = await page.title();
  91  |     console.log("Page title:", title);
  92  | 
  93  |     await page.screenshot({ path: "screenshots/pdp-page-loaded.png" });
  94  | 
  95  |     // Check for personalization buttons
  96  |     const giocatoreBtn = page.locator("button:has-text('Giocatore')").first();
  97  |     const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
  98  |     const serieABtn = page.locator("button:has-text('SERIE A')").first();
  99  | 
  100 |     console.log(
  101 |       "Giocatore button visible:",
  102 |       await giocatoreBtn.isVisible({ timeout: 2000 }).catch(() => false),
  103 |     );
  104 |     console.log(
  105 |       "Tuo Nome button visible:",
  106 |       await tuoNomeBtn.isVisible({ timeout: 2000 }).catch(() => false),
  107 |     );
  108 |     console.log(
  109 |       "SERIE A button visible:",
  110 |       await serieABtn.isVisible({ timeout: 2000 }).catch(() => false),
  111 |     );
  112 | 
  113 |     // Check for add to cart
  114 |     const addBtn = page.locator(ADD_TO_CART_BTN).first();
  115 |     const addBtnVisible = await addBtn
  116 |       .isVisible({ timeout: 3000 })
  117 |       .catch(() => false);
  118 |     console.log("Add to cart button visible:", addBtnVisible);
  119 | 
  120 |     // Check price
  121 |     const priceEl = page.locator(PRICE_SEL).first();
  122 |     const price = await priceEl.textContent().catch(() => null);
  123 |     console.log("Product price:", price?.trim());
  124 | 
  125 |     await page.screenshot({ path: "screenshots/pdp-sections.png" });
  126 |   });
  127 | 
  128 |   test("PDP-002: Size selection via popover", async ({ page }) => {
  129 |     // On PDP, size is likely in a popover/dropdown. Look for size-related elements
  130 |     const sizePopover = page
  131 |       .locator(
  132 |         "[data-option-type='size'], .Popover:has(button[data-option-type='size'])",
  133 |       )
  134 |       .first();
  135 |     const sizePopoverVisible = await sizePopover
  136 |       .isVisible({ timeout: 3000 })
  137 |       .catch(() => false);
  138 |     console.log("Size popover visible:", sizePopoverVisible);
  139 | 
  140 |     // Try to find and click the size selector to open the popover
  141 |     const sizeToggle = page
  142 |       .locator(
  143 |         "button:has-text('Taglia'), [data-action='select-size'], .Popover__Toggle",
  144 |       )
  145 |       .first();
  146 |     const sizeToggleVisible = await sizeToggle
  147 |       .isVisible({ timeout: 2000 })
  148 |       .catch(() => false);
  149 |     console.log("Size toggle visible:", sizeToggleVisible);
  150 | 
  151 |     if (sizeToggleVisible) {
  152 |       await sizeToggle.click({ force: true });
  153 |       await page.waitForTimeout(1000);
  154 | 
  155 |       // Now look for size options in the popover
  156 |       const sizeOptions = await page
  157 |         .locator(".Popover__Value[data-option-type='size']")
  158 |         .all();
  159 |       console.log("Size options in popover:", sizeOptions.length);
  160 | 
  161 |       for (const opt of sizeOptions) {
  162 |         const text = await opt.textContent();
  163 |         const isDisabled = await opt.evaluate((el) =>
  164 |           el.classList.contains("disabled"),
  165 |         );
  166 |         const isSelected = await opt.evaluate((el) =>
  167 |           el.classList.contains("is-selected"),
  168 |         );
  169 |         console.log(
  170 |           `Size ${text?.trim()}: disabled=${isDisabled}, selected=${isSelected}`,
  171 |         );
  172 |       }
  173 | 
  174 |       // Click a non-disabled size
  175 |       for (const opt of sizeOptions) {
  176 |         const isDisabled = await opt.evaluate((el) =>
  177 |           el.classList.contains("disabled"),
  178 |         );
  179 |         const isSelected = await opt.evaluate((el) =>
  180 |           el.classList.contains("is-selected"),
  181 |         );
  182 |         if (!isDisabled && !isSelected) {
  183 |           const text = await opt.textContent();
  184 |           console.log("Selecting size:", text?.trim());
> 185 |           await opt.click({ force: true });
      |                     ^ Error: locator.click: Element is outside of the viewport
  186 |           await page.waitForTimeout(500);
  187 |           break;
  188 |         }
  189 |       }
  190 |     }
  191 | 
  192 |     await page.screenshot({ path: "screenshots/pdp-size-selection.png" });
  193 |   });
  194 | 
  195 |   test("PDP-003: Tuo Nome - inputs appear and fill correctly", async ({
  196 |     page,
  197 |   }) => {
  198 |     const tuoNomeBtn = page.locator("button:has-text('Tuo Nome')").first();
  199 |     const tuoNomeVisible = await tuoNomeBtn
  200 |       .isVisible({ timeout: 3000 })
  201 |       .catch(() => false);
  202 |     console.log("Tuo Nome button visible:", tuoNomeVisible);
  203 | 
  204 |     if (tuoNomeVisible) {
  205 |       await tuoNomeBtn.click({ force: true });
  206 |       await page.waitForTimeout(1500);
  207 | 
  208 |       const nameInput = page.locator("input[placeholder='Nome']").first();
  209 |       const nameVisible = await nameInput
  210 |         .isVisible({ timeout: 2000 })
  211 |         .catch(() => false);
  212 |       console.log("Name input visible:", nameVisible);
  213 | 
  214 |       if (nameVisible) {
  215 |         const maxLength = await nameInput.getAttribute("maxlength");
  216 |         console.log("Name maxlength:", maxLength);
  217 |         await nameInput.fill("Rossi");
  218 |         console.log("Filled name: Rossi");
  219 |       }
  220 | 
  221 |       const numberInput = page.locator("input[placeholder='Numero']").first();
  222 |       const numberVisible = await numberInput
  223 |         .isVisible({ timeout: 2000 })
  224 |         .catch(() => false);
  225 |       console.log("Number input visible:", numberVisible);
  226 | 
  227 |       if (numberVisible) {
  228 |         const maxLength = await numberInput.getAttribute("maxlength");
  229 |         console.log("Number maxlength:", maxLength);
  230 |         await numberInput.fill("10");
  231 |         console.log("Filled number: 10");
  232 |       }
  233 | 
  234 |       await page.screenshot({ path: "screenshots/pdp-tuo-nome-filled.png" });
  235 |     }
  236 |   });
  237 | 
  238 |   test("PDP-004: Giocatore - select dropdown and player selection", async ({
  239 |     page,
  240 |   }) => {
  241 |     const giocatoreBtn = page.locator("button:has-text('Giocatore')").first();
  242 |     const giocatoreVisible = await giocatoreBtn
  243 |       .isVisible({ timeout: 3000 })
  244 |       .catch(() => false);
  245 |     console.log("Giocatore button visible:", giocatoreVisible);
  246 | 
  247 |     if (giocatoreVisible) {
  248 |       await giocatoreBtn.click({ force: true });
  249 |       await page.waitForTimeout(1500);
  250 | 
  251 |       const playerSelect = page.locator("select").first();
  252 |       const selectVisible = await playerSelect
  253 |         .isVisible({ timeout: 2000 })
  254 |         .catch(() => false);
  255 |       console.log("Player select visible:", selectVisible);
  256 | 
  257 |       if (selectVisible) {
  258 |         const options = await playerSelect.locator("option").all();
  259 |         console.log("Player options:", options.length);
  260 | 
  261 |         for (let i = 0; i < Math.min(options.length, 5); i++) {
  262 |           const text = await options[i].textContent();
  263 |           console.log(`Option ${i}: "${text?.trim()}"`);
  264 |         }
  265 | 
  266 |         if (options.length > 1) {
  267 |           const secondOptionText = await options[1].textContent();
  268 |           await playerSelect.selectOption({ index: 1 });
  269 |           console.log("Selected player:", secondOptionText?.trim());
  270 |           await page.waitForTimeout(500);
  271 |         }
  272 |       }
  273 | 
  274 |       await page.screenshot({ path: "screenshots/pdp-giocatore-selected.png" });
  275 |     }
  276 |   });
  277 | 
  278 |   test("PDP-005: Full flow - Tuo Nome + Patch + add to cart + verify cart", async ({
  279 |     page,
  280 |   }) => {
  281 |     test.setTimeout(60000);
  282 | 
  283 |     const priceEl = page.locator(PRICE_SEL).first();
  284 |     const basePrice = await priceEl.textContent().catch(() => null);
  285 |     console.log("Base price:", basePrice?.trim());
```