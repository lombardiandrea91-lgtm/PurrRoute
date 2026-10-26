# ADR-0009: MapLibre separato dai servizi cartografici

Stato: accettato il renderer; dati e provider da selezionare. Data: 2026-10-26.

## Contesto e decisione

MapLibre GL JS visualizza la mappa sul client. Tile, stile, glyph/font, sprite,
geocoding, ricerca e percorsi sono risorse o servizi distinti, con adapter e
condizioni proprie. Pin, stati e percorso visivo derivano dal kit purrRoute.

## Verifica licenza e manutenzione

[Repository ufficiale MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js),
consultato il 2026-10-26: licenza BSD-3-Clause dichiarata, commit e release recenti.
Conservare avvisi e attribuzioni richiesti. Versione, compatibilita' browser/GPU e
licenze transitive: non verificato, da controllare prima dell'installazione.

## Alternative e conseguenze

Un SDK legato al provider ridurrebbe la sostituibilita'. MapLibre e' una libreria
cartografica generica, non un pianificatore viaggi riutilizzato.
La sua licenza non concede diritti sui dati o download dei tile. Non usare
demotiles o tile pubblici come infrastruttura di produzione per semplice comodita'.

Attribuzione, cache, proxy server, download offline e riuso dei luoghi richiedono
verifica per ogni provider al passo 1. Queste condizioni sono non verificato.
Con il vincolo segreti solo server, verificare la fattibilita' del percorso dei
tile senza esporre API key o violare termini; altrimenti respingere il candidato.

Download mappe al passo 7 solo se consentito e sostenibile per quote e storage.
In assenza di servizi, mostrare itinerario e coordinate disponibili senza
inventare percorsi o promettere mappe offline non scaricate.