# ADR-0019: Logistica locale del viaggio

Stato: liste e registro spese implementati localmente al passo 8.
Data: 2026-10-26.

## Decisione

Checklist e liste valigia sono entità locali per viaggio; le voci hanno ordine,
stato checked e tombstone. Le spese usano importi interi in unità minori e codice
valuta ISO 4217; i subtotali sono separati per valuta, senza conversione automatica.
La precisione e lo step numerico seguono la valuta riconosciuta da `Intl`.

Le modifiche aggiornano la revisione del viaggio e quindi la coda sync locale.
Liste, voci e spese viaggiano con lo snapshot owner-only definito in ADR-0018;
gli importi non sono suddivisi per partecipante e `paidByUserId` resta null.
Eliminare una lista tombstona le voci; eliminare il viaggio tombstona tutte le
entità logistiche.

Non sono introdotti meteo, prenotazioni, pagamenti, documenti, conversione cambi,
storage remoto o fornitori esterni.

## Confine documenti sensibili

Nessun documento viene caricato o sincronizzato. Per un'eventuale integrazione,
la direzione progettuale è envelope encryption nel client: chiave dati casuale per
documento, cifratura autenticata AES-GCM con nonce univoco, e solo ciphertext e
chiave dati cifrata verso lo storage. La chiave radice non deve essere disponibile
al server in chiaro; nomi, MIME e dimensioni vanno minimizzati perché i metadati
possono comunque rivelare informazioni.

Non è ancora deciso come creare, derivare, recuperare, ruotare o trasferire la chiave
radice tra dispositivi, né come condividerla in futuro con i collaboratori. La password
account da sola non è un protocollo di recovery documentato. Queste decisioni, DPA,
backup e threat model sono gate obbligatori prima di implementare documenti o storage;
la cifratura disco del provider non sostituisce quella applicativa.

## Verifiche e limiti

Repository Dexie e PGlite coprono CRUD, valuta, checklist, spese, relazioni, sync e
tombstone. Browser desktop/mobile verificato senza overflow. La persistenza locale
non è un backup; i dati cloud reali restano non verificati fino a PostgreSQL server
e email/account di produzione.