# ADR-0018: Mappe offline e sincronizzazione

Stato: MVP locale implementato; infrastruttura di produzione non verificata.
Data: 2026-10-26.

## Sincronizzazione

Dexie resta la fonte locale e non adotta servizi cloud o addon sync. Lo schema
locale v2 conserva account remoto, versione server, revisione locale e timestamp
di conferma per viaggio. La coda è derivata dalle revisioni e resta sul dispositivo;
non parte alcun push automatico o in background.

L'utente accede con sessione cookie HttpOnly e sceglie singolarmente quali viaggi
ospite inviare. Il payload include viaggio, giorni, tappe, checklist/packing e spese,
compresi i tombstone; non include l'ID owner locale né note, allegati o documenti.
Il pull elenca solo viaggi posseduti dall'account. L'import di un viaggio non presente
sul device è esplicito e non modifica gli altri viaggi.

PostgreSQL mantiene `trips.sync_version`, distinto dalle revisioni delle entità.
Il push atomico usa la versione attesa; una divergenza restituisce HTTP 409 con lo
snapshot corrente solo al proprietario. Non c'è merge automatico: l'utente sceglie
la copia cloud oppure sostituisce la copia cloud con quella locale. Le eliminazioni
dei viaggi già collegati all'account sono inviate dalla coda dedicata; tombstone
ospiti o di altri account non vengono trasferiti automaticamente. Collaborazione,
ruoli editor/viewer, note e documenti restano fuori dai passi 7/8.

Le route richiedono sessione, Origin e CSRF per i push, validazione runtime e rate
limit. Il server ignora l'owner locale e applica l'account autenticato. Non vengono
memorizzate credenziali o password in IndexedDB/localStorage.

## Mappe offline

Lo style OpenFreeMap viene riscritto su route same-origin `/api/maps/tiles/*`;
il proxy usa User-Agent `purrRoute-PWA/1.0 (offline map tile download)` e accetta
solo style, TileJSON, tile coordinate valide, glyph e sprite previsti. Nessun URL
arbitrario è inoltrato. Il proxy ha un limite locale di 3.200 richieste per IP/ora.

Il comando esplicito scarica l'area visibile e adatta il massimo zoom per restare
entro 3.000 tile; usa al massimo quattro richieste concorrenti e interrompe oltre
50 MiB. Ogni nuovo download sostituisce la cache mappe precedente; un errore elimina
la cache incompleta. Il service worker conserva le sole route tile proxate in
`purrroute-map-tiles`, massimo 3.200 risorse e 30 giorni. La schermata Offline mostra
il numero di risorse, non il numero di aree. Cache Storage è best-effort e non è un
backup; l'utente può svuotarla esplicitamente.

Vengono precaricati i glyph range 0-767 dei font richiesti dallo style; etichette
che richiedono altri range possono non apparire offline. È supportata una sola cache
di area alla volta; non c'è gestione di pacchetti multipli o stima preventiva precisa
della dimensione. Servizio, tile e cache possono essere revocati/evicted. Restano
validi attribuzione e requisito ToS sull'età/capacità di chi integra OpenFreeMap.

## Verifiche e limiti

Verificati localmente: typecheck, suite Node/PGlite, push/pull/conflict HTTP mock,
ownership, CSRF/Origin, tombstone, planner tile, proxy e service worker. Browser
Edge: download di area sintetica, 286 risposte tile HTTP 200, 264 risorse in cache,
reload offline con tappa visibile e zero errori JavaScript. Nessun account provider,
spesa o chiave è stato creato.

Il server PostgreSQL reale e le email di produzione non sono disponibili in questo
ambiente; perciò non è stato verificato un account reale né la sync end-to-end contro
PostgreSQL server. L'invio/verifica email locale usa il mail sink di sviluppo.