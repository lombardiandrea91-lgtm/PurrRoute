# ADR-0023: Posizione foreground e avvisi locali

Stato: MVP locale implementato; Web Push remoto non attivato. Data: 2026-10-26.

## Decisione

La mappa può monitorare la posizione solo dopo un gesto esplicito su “Attiva
avvisi”. Il browser richiede il permesso geolocalizzazione; se le notifiche di
sistema sono supportate viene richiesto anche quel permesso. La ricerca usa
`watchPosition` con accuratezza non alta e controlla le tappe non visitate del
viaggio selezionato entro 100, 250 o 500 metri. Quando più tappe sono vicine,
segnala solo la più vicina e non ripete l'avviso per la stessa tappa durante la
sessione di monitoraggio.

La posizione è elaborata in memoria nel browser, non viene inviata al server,
salvata in IndexedDB o aggiunta al viaggio. Il watcher viene fermato quando
l'utente disattiva gli avvisi, cambia viaggio, esce dalla mappa o la pagina diventa
nascosta; riparte solo quando la pagina torna visibile e gli avvisi sono ancora
attivi. L'avviso appare nell'interfaccia; quando il permesso è concesso viene
mostrata anche una notifica del browser.

## Limiti di piattaforma

Non si usa geofencing nativo né tracking in background. Le notifiche sono generate
dal client mentre la pagina è attiva: il browser può sospenderle, quindi non sono
push remoto, promemoria affidabili a orario esatto o consegne garantite offline.
La preferenza non è persistita e si disattiva alla navigazione/unmount. Accuratezza
GPS, risparmio batteria, permessi e comportamento installato variano per browser e
dispositivo; iOS/Android e TWA richiedono verifiche manuali al passo 13.

Web Push standard resta il candidato per notifiche quando l'app non è aperta, ma
non viene attivato in questo MVP: mancano chiavi VAPID configurate, iscrizioni
persistite, job scheduler e verifica dei servizi push browser/regioni. Non si
aggiunge un provider terzo, né una posizione periodica o un backend di tracking.

## Verifiche

Test automatici coprono distanza geodetica, selezione della tappa più vicina,
esclusione tappe visitate, raggio e deduplicazione per sessione. TypeScript/build
verificano il componente browser. Nessuna notifica reale o geolocalizzazione su
dispositivo fisico è stata provata; non sono stati contattati endpoint remoti.