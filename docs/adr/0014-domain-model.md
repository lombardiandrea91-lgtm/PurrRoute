# ADR-0014: Modello dominio per viaggi e tappe

Stato: accettato per il primo schema del passo 4. Data: 2026-10-26.

## Contesto e decisione

Il kit definisce 14 categorie di pin e quattro aspetti visivi, ma una tappa puo'
essere contemporaneamente preferita e visitata. Il dominio distingue quindi la
pianificazione (`planned` o `optional`) dai marcatori `isFavorite` e `visitedAt`.
I nomi persistiti delle categorie sono identificatori stabili in inglese; le
etichette italiane/inglesi restano presentazione, non valori di archivio.

Le entita' previste sono account, viaggio, giorno, tappa, membership, nota,
lista, elemento lista, spesa e metadati documento. Le entita' modificabili usano
ID stabili, revisione e tombstone per preparare contratti local-first; questo non
definisce ancora merge, sincronizzazione o retention dei dati cancellati.
Un account non contiene hash password nel modello condiviso del dominio.
Il riferimento file e' opaco e non e' un URL firmato o un'integrazione storage.

## Conseguenze e limiti

Il dominio non dipende da React, database, trasporto o servizi esterni. Nessuna
dipendenza nuova e' necessaria per questo modello. Vincoli SQL, validazione runtime,
autorizzazione, registrazione account e politiche di cancellazione verranno definite
nel seguito del passo 4 e non sono dichiarate implementate da questo ADR.

Il modello delle membership anticipa ruoli base per enforcement server; inviti e
collaborazione restano al passo 11. La categoria `waypoint` corrisponde alla
Zampata generica del kit. Il testo "quindici categorie" resta un refuso originale:
il conteggio canonico e' 14.