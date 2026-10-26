# ADR-0017: Renderer mappa e servizi geospaziali

Stato: renderer e tile online selezionati; geocoding/routing opt-in; offline rinviato.
Fonti ufficiali ricontrollate: 2026-10-26.

## Decisione

Usare MapLibre GL JS 6.16.0 (BSD-3-Clause) come renderer. Tile/style online
predefiniti da OpenFreeMap, senza chiave o proxy nostro. Il service worker non
memorizza tile/style/glyph; attribuzione OpenFreeMap, OpenMapTiles e OpenStreetMap
resta sempre visibile tramite MapLibre e link provider.

La mappa legge soltanto tappe del viaggio locale selezionato. Tutte le coordinate
sono opzionali; selezionare una tappa dalla lista centra la mappa e viceversa. Il
click mappa assegna coordinate manuali; i pin provengono dai 14 SVG del kit.
Tappe vicine si aggregano visivamente, preferito/visitato restano marcatori distinti.
Le coordinate di ogni tappa conservano anche `locationSource` e, per risultati
LocationIQ selezionati, `sourcePlaceId` per attribuzione e tracciabilità.
Più coordinate possono essere unite da una linea tratteggiata solo dichiarata come
collegamento schematico diretto, mai come strada o stima di durata.

Geocoding e routing stanno dietro adapter client/API e sono spenti se non configurati.
LocationIQ è il candidato implementato ma richiede entrambi `MAP_LOCATIONIQ_ENABLED=true`
e `LOCATIONIQ_API_KEY` nell'ambiente server. La chiave non entra nel bundle web, Git,
query string client o log. Le richieste passano per POST stesso-origin, CSRF, controllo
Origin, validazione runtime, rate limit, timeout, cache temporanea e risposta d'errore
normalizzata. La search UI dichiara l'invio del testo; il routing invia coordinate solo
dopo un'azione esplicita. Nessun fallback chiama un provider diverso.

## Provider: fatti verificati e limiti

### OpenFreeMap

Fonti: [ToS](https://openfreemap.org/tos/), [privacy](https://openfreemap.org/privacy/),
[quick start](https://openfreemap.org/quick_start/),
[repository](https://github.com/hyperknot/openfreemap). ToS 14-10-2026, privacy
08-10-2026. Istanza pubblica dichiarata gratuita, senza limite di richieste, account,
API key o cookie; uso commerciale permesso. Attribuzione OpenMapTiles e OpenStreetMap
richiesta. Nessun SLA e servizio revocabile. CDN Cloudflare possibile; regione dati
non garantita. Access logs senza IP per default, conservati 7 giorni; error logs che
possono includere IP/URL fino a 7 giorni; log IP temporanei in incidenti fino a 30
giorni. ToS richiede che l'integratore abbia almeno 18 anni e capacità legale:
verifica necessaria prima del rilascio pubblico. Nessun offline in questo passo;
futuri download limitati a 3.000 tile o 50 MB per richiesta, massimo 4 richieste
parallele e User-Agent applicazione univoco. Copertura/qualità Italia e continuità
futura del servizio: non verificato; smoke test solo su tile sintetici di Roma.

### LocationIQ

Fonti: [pricing](https://locationiq.com/pricing), [ToS](https://locationiq.com/tos),
[DPA](https://locationiq.com/dpa), [search docs](https://docs.locationiq.com/docs/search-forward-geocoding),
[directions docs](https://docs.locationiq.com/docs/directions-api),
[attribution](https://locationiq.com/attribution). Free: 5.000 richieste/giorno,
2/sec, 60/minuto; limited commercial use con link "Search by LocationIQ.com";
cache request-response Free massimo 48h. Endpoint EU `eu1.locationiq.com` documentato
per search/reverse/directions. Directions: driving/walking, massimo 25 coordinate
long/lat; response contiene GeoJSON, distanza e durata.

L'adapter applica limiti più bassi di 4.500 richieste/giorno, 2/sec, 60/minuto,
timeout 3s e cache in-memory 48h. I contatori sono per singolo processo, non condivisi:
non sono sufficienti per deployment multiistanza senza store atomico. Ruoli del DPA,
retention e regione effettiva dei log/trasferimenti: non verificato; LocationIQ ha
sede in India e l'endpoint UE non dimostra trattamento esclusivamente UE. Il DPA
richiede riesame legale e privacy prima di attivare il flag in produzione. Nessuna
key, account o chiamata live sono stati creati/eseguiti.

### openrouteservice

La documentazione Directions API conferma endpoint e geometria, ma il sito corrente
avvisa indisponibilità e la pagina plans restituisce 404. Prezzi/quote API correnti,
termini di cache/archiviazione e residenza: non verificato. Rimane non selezionato e
non integrato.

## Conseguenze e verifiche

Con rete assente la lista tappe resta utilizzabile; basemap, geocoding e routing non
sono garantiti offline. Il public tile service può cambiare o interrompersi; nessun
SLA e nessuna cache offline sono promessi. La soluzione road route resta disattivata
senza opt-in/provider; il collegamento schematico non attribuisce strade o tempi.

Verificato: server tile/style OpenFreeMap risponde 200 per 26 richieste browser di
smoke test con dati sintetici; pin, cluster, click manuale, selezione lista↔mappa e
viewport desktop/mobile controllati. Test automatizzati coprono schema API, CSRF,
Origin, quota, timeout, cache e adapter con fetch mock. Nessun benchmark di copertura
Italia, richiesta geocoding/routing live, test offline mappe o test di lettore schermo
eseguito.