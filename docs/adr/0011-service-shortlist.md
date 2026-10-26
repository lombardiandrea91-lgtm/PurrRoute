# ADR-0011: Shortlist servizi e condizioni di attivazione

Stato: accettato come esito della ricerca, non autorizzazione all'integrazione.
Data: 2026-10-26. Evidenze e fonti nella [ricerca](../service-selection.md).

## Contesto e fatti

Confrontate 21 alternative in nove categorie su documentazione ufficiale.
Le evidenze non recuperabili sono etichettate non verificato, comprese
quote ORS, termini cloud MapTiler, quota transazionale Brevo e residenza completa
dei dati dei vari servizi. Nessun account, chiave o richiesta API con dati reali.

## Decisione

Shortlist: MapTiler per tile online non commerciali, LocationIQ per geocoding,
openrouteservice per routing, Open-Meteo per meteo, Wikidata per dati culturali
con Overpass complementare, Supabase Storage per file, Brevo per email,
Web Push standard per notifiche. Non e' una selezione di produzione definitiva:
ogni voce resta bloccata finche' le sue condizioni aperte non sono verificate.

AI/visione disattivate: nessuna delle due opzioni studiate ha dimostrato insieme
budget zero, uso pubblico in Italia e nessuna conservazione come richiesto.
PMTiles con dati propri e' una direzione per mappe offline, non infrastruttura
gia' pronta o gratuita. Non avviare integrazioni durante design system e shell.

## Alternative e conseguenze

OSMF tile non e' il backend di produzione predefinito e vieta download offline;
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