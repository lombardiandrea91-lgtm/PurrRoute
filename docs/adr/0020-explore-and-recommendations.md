# ADR-0020: Esplora e suggerimenti culturali

Stato: MVP locale implementato; WDQS pubblico usato solo su ricerca esplicita.
Data: 2026-10-26.

## Decisione

La vista Esplora parte da una tappa geolocalizzata scelta dall'utente e cerca musei
o parchi entro 1, 3 o 5 km. Il server invia al Wikidata Query Service solo coordinate,
categoria e lingua; non invia titolo/ID viaggio, nomi tappe o dati account. La ricerca
usa classi `P31` dirette per ridurre costo e timeout, massimo 10 candidati upstream,
dedup per QID e verifica locale del raggio. I risultati sono ordinati per distanza,
non sono consigli personalizzati o ranking editoriale.

L'utente aggiunge un risultato al viaggio con azione esplicita. La tappa conserva
`locationSource='wikidata'` e il QID in `sourcePlaceId`; l'attribuzione è visibile
e il record può aprire la scheda Wikidata. I risultati non selezionati non vengono
salvati nel database viaggio. La UI non richiede account e la ricerca funziona con AI
disattivata.

L'adapter server usa POST same-origin, CSRF, validazione TypeBox, limite di 5 query
al minuto, timeout 10 secondi, cache in memoria di 15 minuti/100 chiavi e User-Agent
identificabile. Un HTTP 429 interrompe la richiesta senza retry. Nessun polling,
autocomplete o ricerca automatica all'apertura.

## Limiti e alternative

Wikidata: dati strutturati CC0; la copertura di musei/parchi varia e gli orari,
accessibilità, prezzi, aperture e qualità dei record non sono garantiti. Il ranking
per distanza è deterministico e non equivale a una raccomandazione personalizzata.
La query usa tipi diretti, non l'intera gerarchia `P279*`, perché quest'ultima ha
superato il timeout WDQS nel test Roma; ciò può omettere elementi classificati solo
con sottoclassi.

Overpass/OSM resta non integrato: condizioni aggregate dell'istanza e obblighi ODbL
richiedono una decisione separata prima di costruire una cache combinata. LLM/AI,
immagini, recensioni e foto restano spenti o non adottati. Non chiamare il risultato
“consiglio” sicuro e non basare decisioni di accessibilità o sicurezza sui dati.

## Verifiche

Query reale singola Roma, 3 km: risposta in circa un secondo; il browser ha mostrato
il Museo delle Terme di Diocleziano a circa 225 m. Smoke Edge: query same-origin,
risultato aggiunto localmente con QID/provenance, nessun dato viaggio nella request,
zero errori JS e nessun overflow desktop/mobile. Test mocked coprono dedup, ordinamento,
cache, validazione, timeout/429, CSRF e Origin. Endpoint pubblico senza SLA e qualità
territoriale nazionale non verificate.