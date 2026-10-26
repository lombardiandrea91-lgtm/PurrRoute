# ADR-0010: PWA prima, TWA dopo

Stato: accettato come direzione; pubblicazione non avviata. Data: 2026-10-26.

## Contesto e decisione

Un solo client responsive per browser PC e Android, installabile come PWA.
Distribuzione Google Play con Trusted Web Activity al passo 13, senza duplicare
interfaccia e dominio in un'app nativa separata. Lo stesso account usa lo stesso
backend, non identita' distinte per piattaforma.

## Alternative e conseguenze

Capacitor solo se emerge una funzione necessaria non offerta dalla PWA; nessuna
adozione preventiva. Bubblewrap o PWABuilder restano candidati non selezionati:
licenza e manutenzione saranno verificate prima dell'uso.

Al passo 3: manifest, service worker, installabilita', fallback offline e WCAG AA.
Verificare installazione e comportamento con browser/strumenti correnti; il
requisito Lighthouse PWA verde non implica che ogni versione di Lighthouse
esponga lo stesso badge o audit. Documentare versione e risultati effettivi.

Al passo 13: firma, Digital Asset Links, dominio HTTPS controllato, scheda store,
privacy, Data safety, cancellazione account e requisiti Play aggiornati.
Non garantire pubblicazione o revisione favorevole prima di queste verifiche.
Web Push, posizione e Share Target dipendono da browser e piattaforma; limiti
da documentare nei rispettivi passi.

## Fonti e non verificato

Obiettivi confermati dall'utente il 2026-10-26. Costi Play, target API, eventuali
test chiusi obbligatori, policy correnti, strumenti TWA e supporto delle capacita'
browser: non verificato. Nessun account Play o dominio disponibile al passo 0.