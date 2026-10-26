# ADR-0021: Importazione manuale da link e screenshot

Stato: MVP locale implementato; nessun servizio AI o storage file attivato.
Data: 2026-10-26.

## Decisione

Da un viaggio, l'utente può avviare l'import di una pagina pubblica HTTPS oppure
selezionare uno screenshot locale. Il link viene inviato al server soltanto con
l'azione esplicita “Leggi metadati”. L'adapter legge titolo e descrizione da
Open Graph, `title` e JSON-LD; non carica immagini, script, iframe o altre risorse
della pagina. La preview resta in memoria e non crea una bozza persistente. Nome,
categoria, indirizzo e giorno sono rivedibili; solo l'azione “Aggiungi al viaggio”
crea una tappa. Il link sorgente HTTPS è conservato nella tappa locale e nel sync.

Lo screenshot accetta PNG, JPEG, WebP e GIF fino a 10 MB. È mostrato tramite un
object URL temporaneo nel browser; il file non viene caricato, salvato o analizzato
automaticamente. Non c'è OCR né invio a un modello AI. L'utente trascrive i campi
e conferma la tappa; il file viene rilasciato quando la preview viene rimossa o la
vista viene smontata.

## Confine di rete

La preview usa POST same-origin, Origin/CSRF e un rate limit di cinque richieste
al minuto per IP. Accetta solo HTTPS sulla porta standard, non invia cookie o
credenziali, non conserva cache e imposta `Cache-Control: no-store`. La richiesta
ha timeout assoluto di otto secondi e limite di 1 MB; `robots.txt` ha limite di
128 KB. L'User-Agent identifica PurrRoute.

Per ridurre SSRF, il server risolve ogni host prima di ogni richiesta, rifiuta gli
indirizzi non unicast e passa al socket l'indirizzo pubblico già verificato. Ogni
redirect è limitato a tre salti e il nuovo host viene validato e controllato con
il proprio `robots.txt`. Solo risposte HTML 200 con titolo leggibile producono una
preview. Errori DNS, rete, contenuto o policy diventano un errore generico.

Il parser robots applica le regole `Allow`/`Disallow` per PurrRoute o `*`; un file
non accessibile, un redirect robots o un errore di rete bloccano la preview. Un
404/410 robots equivale ad assenza del file. La preview non prova a stabilire se
un sito consenta riuso o archiviazione dei contenuti: usare pagine pubbliche e
rispettarne termini e diritti resta necessario. Non usare URL privati, autenticati,
firmati o con token; la query può contenere informazioni sensibili. Il frammento
viene rimosso prima della richiesta al sito e non viene conservato nella fonte.

## Dati e migrazioni

`sourceUrl` è opzionale e non sostituisce `locationSource`/`sourcePlaceId` dei
provider di luoghi. La migration 006 aggiunge `trip_stops.source_url`, vincolata a
HTTPS e 2048 caratteri. Dexie v4 normalizza a `null` le tappe preesistenti. Nessun
metadato viene aggiunto al viaggio prima della conferma; il testo importato diventa
parte del normale sync solo dopo che l'utente crea la tappa.

## Limiti e verifiche

Le pagine senza metadati o non accessibili richiedono compilazione manuale.
Il parser non interpreta itinerari completi, prezzi, orari o coordinate e non
promette accuratezza. Gli screenshot non vengono trascritti automaticamente.
Le prove coprono CSRF/Origin, rate limit, rifiuto di HTTP/credenziali/loopback,
migrazioni PostgreSQL, upgrade Dexie e persistenza sync; non è stata eseguita una
preview verso un sito esterno reale. Hosting, provider, account e costi restano
invariati.