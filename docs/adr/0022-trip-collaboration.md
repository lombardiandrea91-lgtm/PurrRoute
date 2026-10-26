# ADR-0022: Collaborazione sui viaggi

Stato: MVP locale implementato; email d'invito e PostgreSQL di produzione restano
non verificati. Data: 2026-10-26.

## Decisione

Il passo 11 attiva le membership già presenti nello schema: owner, editor e viewer.
Il proprietario può aggiungere o cambiare ruolo a un account già esistente con
email verificata. Non si creano inviti pendenti e non si inviano email: il provider
di posta di produzione non è configurato. Una membership diventa attiva subito
dopo la scelta del proprietario. Sono ammessi al massimo 100 account per viaggio,
owner incluso.

Tutti i membri attivi possono vedere il roster; gli indirizzi email dei membri
sono quindi visibili al team e la UI lo dichiara. Solo l'owner gestisce ruoli e
revoche. L'editor può leggere e sincronizzare snapshot complete; il viewer può
leggere/elencare viaggi condivisi ma riceve 403 sui push. L'owner conserva i
permessi di gestione e scrittura.

La rimozione è un tombstone della membership. Query di lettura, elenco cloud e
UPDATE condizionale verificano `deleted_at IS NULL`; dopo la revoca, le successive
richieste non possono più leggere o modificare il viaggio. Le scritture continuano
a usare `sync_version` e conflitto 409: non esiste merge automatico. La condivisione
non sincronizza automaticamente il dispositivo locale e non concede accesso a
viaggi ospite finché il proprietario non li trasferisce esplicitamente.

## Confini API e sicurezza

Le route `/api/collaboration/trips/:tripId/members` richiedono sessione. POST e
DELETE richiedono Origin same-origin e CSRF; le mutazioni hanno rate limit di dieci
richieste al minuto. Gli identificatori sono UUID e TypeBox rifiuta campi/ruoli
extra. L'API non espone password o token. Solo l'owner può assegnare editor/viewer
o revocarli; non è possibile assegnare il ruolo owner. Gli account non verificati
non sono eleggibili.

La tabella membership e i suoi vincoli sono stati creati al passo 4; il passo 11
non aggiunge una migrazione. L'assegnazione usa un upsert sul vincolo univoco
`(trip_id, user_id)` e riattiva la membership revocata. L'owner trip è serializzato
durante l'aggiunta per rispettare il limite di team.

## Limiti e verifiche

Il roster mostra email a ogni membro; non è stata implementata un'accettazione
separata dell'invitato, un flusso di uscita volontaria o una notifica email.
Un editor può sovrascrivere una snapshot intera, perciò i conflitti richiedono
scelta esplicita e il ruolo va assegnato solo a persone fidate. La revoca blocca
le nuove richieste, ma non può cancellare copie già sincronizzate sui dispositivi.

Test embedded PostgreSQL coprono account verificati, owner/editor/viewer, lista
cloud, aggiornamento ruolo, revoca immediata e riattivazione. Test API coprono
sessione, CSRF, Origin e risposta read-only 403. Il server PostgreSQL reale,
l'invio email e la concorrenza multi-client in produzione restano da verificare.