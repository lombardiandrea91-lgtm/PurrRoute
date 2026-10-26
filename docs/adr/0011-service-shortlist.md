# ADR-0011: Shortlist servizi e condizioni di attivazione

Stato: accettato come esito della ricerca, non autorizzazione all'integrazione.
Data: 2026-10-26. Evidenze e fonti nella [ricerca](../service-selection.md).

## Contesto e fatti

Confrontate 21 alternative in nove categorie su documentazione ufficiale.
Le evidenze non recuperabili sono etichettate non verificato, comprese
quote ORS, termini cloud MapTiler, quota transazionale Brevo e residenza completa
dei dati dei vari servizi. Nessun account, chiave o richiesta API con dati reali.

## Decisione

Shortlist ricerca originale: MapTiler, LocationIQ, openrouteservice, Open-Meteo,
Wikidata/Overpass, Supabase Storage, Brevo e Web Push. Al passo 6 è stato valutato
anche OpenFreeMap e scelto solo come tile provider online senza key. LocationIQ
geocoding/routing è implementato ma opt-in con key server; ORS resta non selezionato.
Condizioni privacy/location di LocationIQ e i requisiti ToS OpenFreeMap restano
esplicitati in ADR-0017; nessuna key, account o pagamento provider creato.

AI/visione disattivate: nessuna delle due opzioni studiate ha dimostrato insieme
budget zero, uso pubblico in Italia e nessuna conservazione come richiesto.
PMTiles con dati propri e' una direzione per mappe offline, non infrastruttura
gia' pronta o gratuita. Non avviare integrazioni durante design system e shell.

## Alternative e conseguenze

OSMF tile non e' il backend di produzione predefinito e vieta download offline;
OpenFreeMap non ha SLA e non garantisce regione UE; ToS richiede integratore
maggiorenne, da confermare prima di rilascio, e impone limiti ai download offline;
Nominatim non puo' sostituire autocomplete. Google Places richiede verifiche
distinte sui termini SEE e non permette di presumere salvataggio di intere schede.
R2 ha costi oltre quota: nessun hard cap dimostrato, non attivarlo come gratuito.
Resend necessita dominio verificato per destinatari esterni; non e' disponibile
per il login pubblico col solo dominio di test. FCM/OneSignal aggiungono vincoli
e dati esterni non necessari al nostro invio Web Push standard.

Nessuna modifica al vincolo 0 EUR, nessun pagamento o push. Proseguire con passi
indipendenti dalle integrazioni; prima del rilascio occorre chiudere hosting,
backup, mittente email, protezione dati e condizioni della mappa. Se richiedono
cambio di vincolo, tornare all'utente anche senza gate intermedi di approvazione.

## Verifica

Controllo automatico: tutte le nove categorie hanno 2-3 alternative,
raccomandazione e lacune esplicite; collegamenti locali validi.
Nessun test live, benchmark Italia o audit legale eseguito. Non equiparare
la completezza della tabella alla compatibilita' verificata di tutti i candidati.