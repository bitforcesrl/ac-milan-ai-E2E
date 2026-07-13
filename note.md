facciamo un giro di prova di questo test E2E ed ottimizziamolo per essere eseguito poi nel migliore dei modi.
in questa esecuzione l'obiettivo non e' quello di eseguire il test per ottenere il report ma di migliorare il test per aggiungere dettagli che coprano il 100% delle funzionalita' del personalizzatore

- le info di a comune stare tutte su instructions, delle volte le rimette dentro ogni test ma va tenuto pulito altrimenti vanno in conflitto
- potrebbe essere necessario specificargli esplicitamente dove deve utilizzare la vision rispetto alla lettura da server mcp
- il server mcp ha le sue versioni di browser e se non le trova va in conflitto
- da usare la configurazione di mcp di progetto in modo da non andare in conflitto con altri progetti
- il setup del viewport dicendogli il device fa casino meglio andare con i pixel anche se non passera' il brower agent corretto
- i test funzionano bene fino ad un certo numero di compiti, ricordiamoci che c'e' anche instructions che gira sempre. Se un test diventa con troppi passaggi va splittato
- i permessi al server mcp vanno dati con \* altrienti si blocca in continuo
- potrebbe essere migliore partire in modalita' architect dove pianifica meglio il test, tanto poi e' lui che passa in modalita' code
