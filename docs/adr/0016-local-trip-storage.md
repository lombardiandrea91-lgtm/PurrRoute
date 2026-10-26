# ADR-0016: Archivio locale viaggi e scheduling tappe

Stato: accettato per il passo 5. Verifiche: 2026-10-26.

## Decisione

Il client usa Dexie core 4.4.7 su IndexedDB; nessun addon cloud/sync e' adottato.
Viaggi, giorni e tappe usano ID UUID stabili, revisioni e tombstone. Il proprietario
dei viaggi ospite e' un ID locale persistito nell'archivio e il trasferimento ad
account richiedera' consenso esplicito. Giorni hanno data e ordine; tappe hanno
orario/durata, stato di pianificazione e marcatori preferito/visitato distinti.
Spostamento e riordino avvengono in transazione locale. Eliminare un giorno lascia
le sue tappe nel viaggio non assegnate; eliminare un viaggio crea tombstone locali.

Dexie 4.4.7 dichiara Apache-2.0 e ha release/manutenzione upstream recenti
([repository](https://github.com/dexie/Dexie.js)); sono usate solo le API core.
`fake-indexeddb` 6.2.6 e' Apache-2.0 e dev-only ([repository](https://github.com/dumbmatter/fakeIndexedDB));
serve per testare il repository in Node, ma non sostituisce verifiche browser reali.

## Conseguenze e limiti

La UI resta utilizzabile senza account o rete. IndexedDB puo' essere cancellato o
evicted e non e' un backup. Il modello prepara sincronizzazione futura, ma non
definisce conflitti, coda, trasferimento ospite/account o sync; sono passo 7.
L'orario viene salvato come timestamp ISO; input e visualizzazione usano il fuso
del browser. Il viaggio memorizza il fuso rilevato alla creazione, ma la modifica
del fuso per viaggio e la relativa conversione sono ancora da implementare.