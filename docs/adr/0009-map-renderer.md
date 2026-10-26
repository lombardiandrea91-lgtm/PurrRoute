# ADR-0009: MapLibre separato dai servizi cartografici

Stato: MapLibre/OpenFreeMap online adottati al passo 6; geocoding/routing opt-in
e condizioni privacy ancora aperte in ADR-0017. Data: 2026-10-26.

## Contesto e decisione

MapLibre GL JS visualizza la mappa sul client. Tile, stile, glyph/font, sprite,
geocoding, ricerca e percorsi sono risorse o servizi distinti, con adapter e
condizioni proprie. Pin, stati e percorso visivo derivano dal kit purrRoute.

## Verifica licenza e manutenzione

[Repository ufficiale MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js),
consultato il 2026-10-26: versione 6.16.0, licenza BSD-3-Clause, release recente
e API documentata per Vite/GeoJSON. Conservare avvisi e attribuzioni. Compatibilità
browser/GPU e licenze transitive effettive: da verificare sui browser target.

## Alternative e conseguenze

Un SDK legato al provider ridurrebbe la sostituibilita'. MapLibre e' una libreria
cartografica generica, non un pianificatore viaggi riutilizzato.
La sua licenza non concede diritti sui dati o download dei tile. Non usare
demotiles o tile pubblici come infrastruttura di produzione per semplice comodita'.

OpenFreeMap è il tile provider online documentato in ADR-0017. La sua istanza
pubblica è senza chiave, ma non ha SLA e non garantisce regione UE. Nessun tile è
precache/service-worker-cached. Geocoding e routing usano route server-only opzionali;
non mettere chiavi o query provider nel client. LocationIQ richiede revisione DPA,
informativa e opt-in esplicito prima del rilascio.

Download mappe al passo 7 solo nei limiti ToS: l'istanza OpenFreeMap indica massimo
3.000 tile o 50 MB per download, 4 richieste parallele e User-Agent univoco.
In assenza di routing, mostrare un collegamento schematico dichiarato non stradale,
senza inventare percorsi, distanze o tempi.