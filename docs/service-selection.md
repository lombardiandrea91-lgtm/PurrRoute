# Ricerca dei servizi esterni

Data: 2026-10-26. Passo 1, solo ricerca; nessun servizio attivato.
Stato: confronto documentale completato con lacune esplicite. Raccomandazioni
condizionate; nessuna scelta di produzione definitiva o garanzia di costo zero.

## Metodo

Confrontare 2-3 opzioni per ciascuna categoria su fonti ufficiali. Distinguere
fatti verificati, ipotesi e decisioni aperte. Valutare costo e quote, termini e
diritti di cache/archiviazione, qualita' in Italia e trattamento dati.
Scrivere non verificato dove manca una prova; non dedurre diritti di cache dalla
licenza di una libreria o residenza dati dalla sola sede del fornitore.
Le raccomandazioni non autorizzano account, chiavi, pagamenti o integrazioni.
Le fonti collegate sotto sono state consultate il 2026-10-26. Importi in valuta
originale, senza conversione e senza presumere inclusione delle imposte.
Nessuna chiamata API autenticata, benchmark o prova con dati personali eseguita.
Per tutti i provider la qualita' reale sull'Italia e' non verificato: le valutazioni
di copertura sono ipotesi tecniche, non misurazioni.

## Sintesi delle raccomandazioni

| Categoria | Raccomandazione | Condizione prima di abilitare |
| --- | --- | --- |
| Tile | OpenFreeMap public instance per tile online; PMTiles propri per offline futuro | Nessun SLA; CDN/regione non garantiti; download soggetti a limiti e termini |
| Geocoding | LocationIQ Free lato server | Endpoint UE, DPA, dati OSM e cache di ricerca separata dai dati selezionati |
| Percorsi | LocationIQ Directions solo opt-in; altrimenti schema manuale | DPA/region/retention da chiudere; ORS quote e termini non verificati |
| Meteo | Open-Meteo Free | Solo uso non commerciale; attribuzione e informativa coordinate/log |
| Dati luoghi | Wikidata; Overpass solo complementare | Provenienza e licenze per campo; rispetto dei limiti dell'istanza |
| Visione AI | Nessun provider attivo | Budget zero e non conservazione non soddisfatti insieme dalle opzioni verificate |
| File | Supabase Storage Free, bucket privati | Regione UE specifica, DPA, backup propri e autorizzazione nel nostro backend |
| Email | Brevo come primo candidato; Resend alternativa | Verifica piano transazionale, mittente/dominio e retention prima del login pubblico |
| Push | Web Push standard con VAPID | Consenso, HTTPS, adapter server e verifica corrente dei browser |

Questa e' una selezione di ricerca, non una lista di integrazioni gia' accettate.
Le voci con lacune restano spente fino alla verifica; non aggirare il budget.

## Tile mappa

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [OSMF raster pubblico](https://operations.osmfoundation.org/policies/tiles/) | Nessun prezzo per richiesta; capacita' limitata, best effort, nessuno SLA o quota garantita | Attribuzione visibile, Referer/User-Agent identificabile; rispettare header cache, almeno 7 giorni se non leggibili. Vietati bulk, prefetch e download offline. Proxy sconsigliato e comunque identificabile | Vietato inviare dati personali/confidenziali; regione completa: non verificato. Copertura OSM, qualita' locale da provare |
| [MapTiler Cloud](https://www.maptiler.com/cloud/pricing/) | Free $0: 100k richieste API/mese, 5k sessioni; con MapLibre distinguere richieste tile dalle sessioni SDK. Free si sospende alla quota; Flex da $30/mese con extra | Free per test/personale/non commerciale; logo MapTiler e attribuzione OSM. Termini generali verificati; diritti cloud specifici su proxy, cache e offline: non verificato | Regione dei dati, log e subprocessori: non verificato; non dedurre UE dalla sede svizzera. Italia da provare |
| [PMTiles su storage proprio](https://docs.protomaps.com/deploy/) | Nessun servizio tile da pagare a Protomaps per il solo formato; bucket, dati, richieste e banda hanno costi propri: totale zero non verificato | La guida prevede bucket, richieste range, funzione e CDN. Diritti dipendono dal dataset; licenza dei dati e dello stile e manutenzione librerie da verificare prima dell'uso | Posizione controllabile tramite hosting scelto, non ancora scelto. Un estratto Italia limita dimensioni ma non garantisce completezza |

Raccomandazione originale del passo 1 (superata al passo 6): MapTiler come
candidato online non commerciale. Il passo 6 adotta OpenFreeMap per tile online,
con i limiti aggiunti nella sezione successiva. PMTiles/dataset nostro resta una
direzione offline, non un fallback gratuito gia' disponibile. OSMF non e' il
backend di produzione predefinito. La cache tecnica non autorizza download area.

Fonti ulteriori: [termini MapTiler](https://www.maptiler.com/terms/) e
[licenza OSM](https://www.openstreetmap.org/copyright). La pagina generale
MapTiler rimanda ai termini specifici Cloud: questi ultimi restano da verificare.
Il vecchio URL docs cloud/api/terms ha restituito 404; non e' una prova di permesso.

## Geocoding e ricerca luoghi

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Nominatim pubblico](https://operations.osmfoundation.org/policies/nominatim/) | Gratuito best effort; massimo assoluto 1 richiesta/secondo per tutta l'app, non per utente | Solo ricerche esplicite moderate; autocomplete e raccolta sistematica POI vietati. Identificazione, switch provider e cache richiesti/raccomandati; risultati ODbL | Non inviare dati personali o confidenziali. Regione completa/log: non verificato. Indirizzi italiani da provare, non garantisce civici completi |
| [LocationIQ Free](https://locationiq.com/pricing) | $0, 5.000 richieste/giorno, 2/secondo e 60/minuto; uso commerciale limitato ammesso con link Search by LocationIQ.com | Dati di risposta conservabili; coppie richiesta-risposta in cache massimo 48 ore Free. Vietata cache tile server. Non estrarre dataset sistematicamente | Datacenter US e UE dichiarati; endpoint UE non garantisce da solo trattamento solo UE. DPA disponibile, regione di log/supporto: non verificato. Italia da provare |

Raccomandazione: LocationIQ per ricerca esplicita e futura autocomplete, dopo
verifica dell'endpoint e DPA. Nominatim non e' un fallback automatico per
autocomplete: sceglierebbe un'operazione vietata. In assenza di provider,
inserimento manuale e coordinate restano possibili.

Fonti: [termini LocationIQ](https://locationiq.com/tos), aggiornati 31 marzo 2026,
e [DPA](https://locationiq.com/dpa). Separare cache query con scadenza da nome,
indirizzo e coordinate del luogo confermato dall'utente; conservare provenienza
e attribuzioni/licenze sottostanti. La regola sulle risposte non annulla ODbL.
Prima di usare Nominatim serve scelta deliberata dell'operatore e piena adesione
alla policy, che vieta anche usi generici tramite piattaforme no-code/vibe-coding.

## Percorsi

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [openrouteservice / HeiGIT](https://openrouteservice.org/) | La pagina ufficiale dichiara una chiave Standard gratuita; quote correnti, prezzi extra e frequenza: non verificato | Sito ufficiale temporaneamente indisponibile; vecchie pagine plans/terms restituiscono 404. Uso pubblico, commerciale, cache e durata conservazione: non verificato | Regione API/log e retention: non verificato. Profili e copertura Italia da verificare nella documentazione prima dell'integrazione |
| [GraphHopper](https://www.graphhopper.com/pricing/) | Free senza carta, non commerciale; quantita' precisa Free non estratta, non verificato. Basic 69 EUR/mese, 5.000 crediti/giorno; crediti non sempre equivalenti a richieste | Free senza garanzie e con profili/modalita' limitati. Attribuzioni dati richieste; cache e salvataggio geometrie/durate: non verificato | [Docs](https://docs.graphhopper.com/) dichiarano OSM come fonte predefinita, TomTom alternativa. Regione/retention: non verificato; qualita' Italia da provare |

Raccomandazione originale del passo 1: openrouteservice come primo candidato,
ma non integrarlo finche' quote, termini e trattamento non sono verificati.
Non riportare come correnti vecchi limiti 2.000/giorno presi da tutorial.
GraphHopper e' alternativa non commerciale, non un'autorizzazione ad attivare Basic.
Al passo 6 LocationIQ Directions è stato valutato come adapter opt-in: endpoint e
request/response sono documentati, ma l'attivazione resta condizionata a DPA e
valutazione privacy; ORS e GraphHopper restano non selezionati.
Fallback: ordine tappe e collegamento visivo diretto chiaramente non stradale,
senza inventare tempi di percorrenza. Nessuna delle due opzioni attesta orari
treno/volo o routing trasporto pubblico completo.

## Meteo

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/en/pricing) | Free non commerciale: 10.000 chiamate/giorno, 5.000/ora, 600/minuto, 300.000/mese; richieste grandi possono contare piu' chiamate. Prezzo piano commerciale: non verificato | Dati CC BY 4.0, attribuzione e indicazione modifiche; riuso e cache dati ammessi dalla licenza. Free non per pubblicita'/abbonamenti; app gratuita non implica automaticamente non commerciale | Server Europa e Nord America; log con possibili coordinate per 90 giorni. Trattamento esclusivamente UE: non verificato. Modelli regionali/globali, accuratezza Italia da misurare |
| [WeatherAPI](https://www.weatherapi.com/pricing.aspx) | Tabella riporta 100k chiamate/mese e 3 giorni previsione nella colonna iniziale, uso commerciale indicato. Prezzo e associazione esatta nome piano nella lettura: non verificato | Termini sito letti; termini API del tab non estratti, TTL cache/archiviazione: non verificato. Link di attribuzione apprezzato per free | Regione, retention, subprocessori: non verificato. Copertura globale dichiarata; benchmark Italia assente |

Raccomandazione: Open-Meteo per l'attuale progetto senza monetizzazione, verificando
che l'uso resti nella definizione non commerciale prima di pubblicare.
Cache proposta 30 minuti per localita' approssimata e variabili, non una quota
del provider. Mostrare timestamp e limite dell'orizzonte: un viaggio lontano non
ha previsioni affidabili. Nessuna decisione safety-critical basata solo sull'app.

Fonti: [termini e privacy Open-Meteo](https://open-meteo.com/en/terms) e
[termini WeatherAPI](https://www.weatherapi.com/terms.aspx). Non inviare nome
utente o itinerario; bastano coordinate della localita', non posizione continua.

## Consigli e dati sui luoghi

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) | Accesso pubblico gratuito, nessuna quota acquistata o SLA; seguire limiti API, Retry-After, User-Agent e query ristrette | Dati strutturati CC0: cache e archiviazione ammesse. Testi descrittivi fuori namespace dati e foto hanno licenze distinte | Regione e retention complete: non verificato. Ipotesi: utile per patrimonio culturale italiano, meno per ristoranti, orari e prezzi aggiornati |
| [Overpass / OSM](https://wiki.openstreetmap.org/wiki/Overpass_API) | Istanze pubbliche gratuite sovraccaricabili. La wiki corrente distingue uso una tantum da regolare e aggrega tutti gli utenti; limite effettivo dell'istanza: non verificato | Dati ODbL: attribuzione e obblighi sulle banche dati derivate, non sul codice applicativo. Cache ammessa dalla licenza, non polling illimitato o scraping nazionale | Regione e retention dell'istanza scelta: non verificato. Ipotesi: POI Italia variabili per zona; non garantisce disponibilita' o orari |
| [Google Places](https://developers.google.com/maps/documentation/places/web-service/policies) | Prezzi e quote attuali SKU: non verificato; non adottare il vecchio credito mensile come fatto corrente | Policy limita cache; place ID conservabile indefinitamente, non tutta la scheda. Attribuzioni foto/autori e termini SEE distinti. Compatibilita' MapLibre da verificare specificamente nei termini SEE | Regione/retention e copertura Italia misurata: non verificato; ipotesi maggiore ricchezza commerciale, non prova |

Raccomandazione: Wikidata per dati culturali, Overpass solo complementare con
query su richiesta e cache controllata. Il ranking dei consigli resta nostro,
deterministico e spiegabile; il modello AI e' un adapter separato e spento.
Non copiare recensioni, foto o intere schede Google dentro il database offline.

Fonti: [licenza Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) e
[licenza OSM](https://www.openstreetmap.org/copyright). Conservare ID fonte,
licenza per campo e data aggiornamento; non mescolare ODbL e dati propri senza
valutare gli obblighi sulla banca dati. Non assumere che una foto collegata da
Wikidata sia CC0. Nessuna licenza AGPL di server remoto e' adottata nel nostro codice.

## LLM con visione

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Gemini Developer API](https://ai.google.dev/gemini-api/docs/pricing) | Alcuni modelli multimodali hanno quota gratuita; limiti effettivi per progetto/modello: non verificato. Esempio tabella 2.5 Flash-Lite paid: $0,10 input testo/immagine e $0,40 output per milione token; disponibilita' futura da ricontrollare | Output non rivendicato da Google, obblighi su contenuti e citazioni. Grounding Search/Maps ha restrizioni specifiche incompatibili con una cache generica dei consigli | Termini richiedono Paid Services per API client offerti in SEE/CH/UK. Eccezione SEE all'uso dei dati per miglioramento non equivale a ZDR; paid prevede log temporanei e trattamento anche fuori UE |
| [OpenAI API](https://openai.com/api/pricing/) | API a consumo, piano gratuito di produzione non verificato. Prezzi correnti esposti per modelli multimodali, costo per screenshot varia con modello/token; preventivo del modello scelto: non verificato | Possibile output strutturato, ma diritti e modello/versione da fissare. Cache provider e applicativa sono concetti diversi; non attivare tool di ricerca o file persistenti implicitamente | Nessun training API salvo opt-in; log abuso di default fino a 30 giorni. ZDR richiede approvazione e ha eccezioni anche per immagini. Regione Europe include SEE e Svizzera; immagini/regionalita' richiedono requisiti aggiuntivi |

Raccomandazione: nessun LLM attivo con budget zero e requisito nessuna
conservazione. Non basta `store:false`, e consenso non risolve una condizione
contrattuale incompatibile. Gemini Free non e' scelto per screenshot privati;
OpenAI e' candidato da riesaminare solo con budget e contratto appropriati.
Per l'Italia: qualita' estrazione in IT/EN non verificato, da misurare su immagini
sintetiche/redatte prima di dati reali; nessun invio effettuato nella ricerca.

Fonti: [termini Gemini](https://ai.google.dev/gemini-api/terms),
[controlli dati OpenAI](https://developers.openai.com/api/docs/guides/your-data).
Le immagini possono essere trattenute per verifiche di sicurezza anche in casi
ZDR: la promessa assoluta di non conservazione non e' dimostrata.
Fallback: metadati strutturati per link e compilazione manuale; screenshot
caricabile come allegato locale solo con esplicita scelta, non finto parsing AI.

## Storage file

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Supabase Storage](https://supabase.com/pricing) | Free $0: 1 GB file, 5 GB egress e 5 GB cached egress; upload massimo 50 MB. DB 500 MB, pausa dopo una settimana inattiva; backup automatici non inclusi | Bucket privati e access control/RLS documentati; service key bypassa RLS e deve restare server. Diritto sui file nostri non autorizza hosting di file di terzi senza licenza; TTL URL e cache privata da configurare | [Regioni](https://supabase.com/docs/guides/platform/regions): scegliere regione specifica UE, non generica Europa che puo' includere UK/CH. DPA, log/supporto e backup completi: non verificato. Latenza Italia da provare |
| [Cloudflare R2 Standard](https://developers.cloudflare.com/r2/pricing/) | Free allowance 10 GB-mese, 1M operazioni A e 10M B/mese, egress diretto gratuito. Oltre: $0,015/GB-mese, $4,50/M A, $0,36/M B; non e' piano con hard cap verificato | Oggetti nostri, compatibilita' S3; cifratura, URL firmati e termini completi da verificare prima integrazione. Quote proprie necessarie anche per URL gia' emessi | [Giurisdizione eu](https://developers.cloudflare.com/r2/reference/data-location/) garantisce collocazione oggetti, un semplice location hint no. Log, supporto e altri servizi: non verificato. Non dedurre che tutta Cloudflare sia UE |

Raccomandazione: Supabase Free in regione UE specifica come candidato iniziale
per file piccoli, con quota app sotto quella del provider. Non adottare Supabase
Auth o Realtime perche' presenti nel piano: account e sync restano nostri.
R2 non viene attivato con il vincolo zero addebiti finche' non si dimostra un
limite rigido, compresi accessi a URL firmati. Nessun bucket creato.

Fonte accessi: [Supabase Storage security](https://supabase.com/docs/guides/storage/security/access-control).
Il nostro backend deve validare utente/viaggio prima di firmare URL brevi. ADR-0019
definisce l'envelope encryption client-side come direzione, ma lascia aperti recovery,
rotazione, trasferimento chiavi e collaborazione: documenti/storage non sono implementati
né autorizzati fino a questi gate. Non equiparare cifratura disco provider a cifratura
del documento. Non usare cache CDN pubblica; backup file non incluso nel backup SQL.

## Email

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Brevo](https://www.brevo.com/pricing/) | Free senza carta dichiarato; quota transazionale Free esatta non estratta: non verificato. Starter 7 EUR/mese non adottabile col budget zero | API/SMTP e mittente da verificare nel prodotto transazionale, non dedurre quota da add-on marketing. Termini di invio, retention contenuto e domini gratuiti: non verificato | [Storage](https://help.brevo.com/hc/en-us/articles/360001005510-Where-does-Brevo-host-my-data): DB in UE, OVH Francia/Germania e Google Belgio, backup cifrati. Non prova che tutti i destinatari/subprocessori siano UE. Deliverability Italia da provare |
| [Resend](https://resend.com/pricing) | Free $0, 3.000 email/mese e massimo 100/giorno; Pro da $20/mese, non adottato | Il dominio resend.dev e' solo test al proprio indirizzo. Serve dominio verificato per destinatari esterni. Free: retention dati 30 giorni; evitare contenuti sensibili e tracking | Invio multi-region disponibile, residenza completa dei dati/log: non verificato. Qualita' IT/EN dei template nostra, recapito da provare |

Raccomandazione: Brevo come primo candidato per collocazione DB dichiarata UE;
chiudere quota transazionale, mittente e DPA prima dell'integrazione. Resend
alternativa con limiti espliciti ma senza dominio disponibile non abilita account
pubblici. Nessun costo dominio approvato e nessun test con indirizzi reali.

Fonti: [test resend.dev](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[catalogo ufficiale Brevo](https://brevo.com/pricing.md). Il catalogo marketing
non e' prova dei limiti dell'API transazionale. Non riportare 300/giorno da memoria
come quota verificata. La cache email e' una coda idempotente privata a scadenza,
non un archivio di password o link validi nei log. In sviluppo usare un trasporto
locale; in pubblico non omettere verifica email e recupero password per aggirare
questo vincolo. OTP, token e contenuti non devono apparire nei log di produzione.

## Push

| Opzione | Costo e quota verificati | Termini, cache e archiviazione | Privacy e Italia |
| --- | --- | --- | --- |
| [Web Push standard](https://web.dev/articles/push-notifications-overview) | Nessun abbonamento intermediario previsto dal protocollo; costi server nostri e quote effettive del servizio browser: non verificato | Consenso con gesto utente, service worker, payload cifrato e VAPID. Iscrizioni persistite sul nostro backend, TTL dei messaggi; non e' consegna garantita o timer preciso | Il browser sceglie il servizio push; non si puo' imporre UE a tutti gli endpoint. Metadati comunque esterni, payload minimo. IT/EN nei nostri template |
| [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) | Pricing ha richiesto redirect non seguito: costo/quota corrente non verificato, non assumere tutto Firebase gratuito | SDK o server protocol e client richiesti; token/installation IDs vanno gestiti e cancellati. Eventuali analytics separati, non attivati automaticamente | [Privacy](https://firebase.google.com/support/privacy): servizio globale; installation IDs fino a richiesta cancellazione, poi rimozione da live/backup entro 180 giorni. Non garantisce UE |
| [OneSignal](https://onesignal.com/pricing) | Free $0, Web Push massimo 10.000 iscritti per invio; Growth da $19/mese piu' quota per iscritto | Retention Free iscrizioni attive negli ultimi 18 mesi; termini completi/cache ed export: non verificato. Ulteriore intermediario e gestione dati | Regione trattamento/DPA Free: non verificato; dicitura GDPR non e' certificazione di trattamento solo UE. Recapito Italia dipende dai browser |

Raccomandazione: Web Push standard, con libreria di protocollo da verificare al
passo 12. Non serve SDK Firebase nel client per usare un endpoint push Chrome.
Chiave VAPID pubblica nel browser ammessa; privata e credenziali server segrete.
Inviare un riferimento opaco, non documenti o dettagli di prenotazione nel payload.
Fallback: promemoria dentro app; non promettere push offline alla scadenza esatta.
La guida web.dev consultata e' una fonte di architettura datata 2020: supporto
browser corrente e permessi Android/TWA vanno verificati al passo 12, non sono
stati attestati da questa pagina.

## Rischi e decisioni ancora aperte

- Hosting Node, database, storage e backup tutti UE a zero: non verificato. La
	quota Supabase non risolve da sola l'hosting Node o la protezione dei backup.
- Un'app gratuita pubblica puo' comunque essere commerciale secondo i termini
	del provider. Non introdurre pubblicita', affiliazioni o abbonamenti senza riesame.
- Routing: sito ORS temporaneamente non disponibile; la homepage dichiara che
	le API restano raggiungibili, non e' prova di quote o diritti di archiviazione.
- Per ogni integrazione: validare nuovamente la pagina ufficiale e configurare
	limiti sotto quota, timeout, attribuzioni e fallback prima di attivarla.
- Non trasferire PII a OSMF; minimizzare query geografiche, evitare nomi/account,
	screenshot e interi itinerari verso provider cartografici o meteo.
- La ricerca non e' un parere legale e nessuna fonte garantisce conformita' GDPR
	automatica. DPA e analisi del flusso dati restano obblighi prima del rilascio.

## Verifica manuale e automatica

Checklist manuale: leggere raccomandazioni e lacune; confrontare quote con il
carico reale prima di abilitare; verificare che AI resti spenta e che nessun
candidato sia trattato come contratto accettato. Testare Italia in seguito con
localita' urbane/rurali, civici, musei, sentieri e nomi ambigui, senza dati privati.

Controlli automatici: presenza delle nove categorie, 2-3 opzioni per categoria,
fonti HTTPS, raccomandazioni e campi non verificati; collegamenti locali Markdown.
Test live nel passo 6: solo tile OpenFreeMap in browser con dati sintetici; nessuna
richiesta LocationIQ o ORS e nessuna chiave/account provider creati.

## Addendum passo 6: tile e servizi geospaziali

Fonti ufficiali ricontrollate il 2026-10-26 prima dell'integrazione.

### Tile: OpenFreeMap

Fatti verificati su [sito](https://openfreemap.org/), [ToS](https://openfreemap.org/tos/),
[privacy](https://openfreemap.org/privacy/) e [quick start](https://openfreemap.org/quick_start/):
istanza pubblica dichiarata gratuita, senza numero massimo di richieste/pubblicazioni,
registrazione, API key o cookie; uso commerciale esplicitamente ammesso. Attribuzione
OpenMapTiles e OpenStreetMap richiesta; MapLibre la mostra dal TileJSON/style. Tile,
glyph e sprite sono richiesti al dominio tiles.openfreemap.org. Servizio as-is, senza
SLA e revocabile. Il provider può usare Cloudflare; residenza dei dati e regione dei
log non garantite. Log accessi anonimizzati per 7 giorni; i log d'errore possono
contenere IP e URL per 7 giorni; logging IP temporaneo per incidenti fino a 30 giorni.
ToS aggiornata 14 ottobre 2026 e privacy 8 ottobre 2026. Chi integra il servizio deve
avere almeno 18 anni e capacità legale di accettare i termini: requisito da confermare
prima del rilascio pubblico. Offline: massimo 3.000 tile o 50 MB per download, massimo
4 richieste parallele e User-Agent univoco; dimensioni superiori richiedono accordo.

Decisione passo 6: usare l'istanza pubblica OpenFreeMap per tile online tramite
MapLibre. Il passo 7 aggiunge proxy same-origin con User-Agent applicativo e download
offline limitato; il service worker cachea solo le risorse tile proxate. L'archivio
manuale resta disponibile quando provider/API non rispondono. Limiti e trade-off in
[ADR-0018](adr/0018-offline-maps-and-sync.md). Mantenere attribuzione visibile e
verificare le licenze delle fonti.
Qualità specifica Italia e disponibilità futura: non verificato; il test browser ha
caricato tile e glyph di una vista sintetica di Roma, senza benchmark territoriale.

MapTiler Free resta alternativa esclusa come default: la pagina ufficiale corrente
lo dichiara adatto a test, prototipi, uso personale o non commerciale. Una app
pubblica gratuita non è automaticamente non commerciale; inoltre Free ha limiti di
100k richieste API e 5k sessioni/mese, si sospende a quota e richiede logo MapTiler.
Termini specifici cache/proxy e regione non verificati. OSMF public raster resta
escluso per produzione/offline secondo policy, nonostante il costo nominale zero.

### Geocoding e routing: LocationIQ opzionale

Fatti verificati su [pricing](https://locationiq.com/pricing),
[ToS](https://locationiq.com/tos), [DPA](https://locationiq.com/dpa),
[Search API](https://docs.locationiq.com/docs/search-forward-geocoding),
[Directions API](https://docs.locationiq.com/docs/directions-api) e
[attribution](https://locationiq.com/attribution): piano Free 5.000 richieste/giorno,
2 richieste/secondo e 60/minuto; uso commerciale limitato ammesso con link
"Search by LocationIQ.com"; coppie richiesta/risposta in cache per massimo 48 ore
nel piano Free. La documentazione indica endpoint UE `eu1.locationiq.com` per search,
reverse e directions. Directions supporta driving/walking e fino a 25 coordinate,
ordinate longitude/latitude; l'API espone geometry, distanza e durata. La documentazione
non specifica una quota separata per routing: quota geocoding/routing è trattata come
condivisa e l'adapter limita l'uso complessivo localmente a 4.500/giorno, 60/minuto,
2/secondo, timeout 3s e cache in-memory massimo 48 ore.

Limiti: DPA disponibile, ma ruoli descritti non sono sufficientemente chiari per
assumere un accordo standard controller/processor; residenza effettiva dei log,
retention e trasferimenti dal DPA non verificati. Endpoint EU non garantisce da solo
trattamento UE esclusivo. Geocoding e routing inviano testo/coordinate di viaggio a
LocationIQ: UI mostra disclosure e solo un'azione esplicita invia la richiesta. La key
è solo server. L'opt-in richiede `MAP_LOCATIONIQ_ENABLED=true` e `LOCATIONIQ_API_KEY`;
entrambi assenti per default. Non sono stati effettuati test live LocationIQ. Prima di
abilitare in produzione occorrono riesame del DPA, informativa privacy e decisione
esplicita sul trasferimento di coordinate a un provider con sede in India.

### Routing: ORS non selezionato

Le pagine ufficiali correnti di ORS restano parzialmente indisponibili: la homepage
avvisa della chiusura e `plans/` restituisce 404; la documentazione backend spiega gli
endpoint ma non prova prezzi/quote/termini di hosting API. Anche se la pagina dichiara
una chiave Standard gratuita, quote, cache geometrie, retention, regione e uso
pubblico restano non verificato. ORS non viene integrato. Quando il routing è assente
la mappa mostra soltanto una linea diretta tratteggiata etichettata esplicitamente
"collegamento schematico, non stradale" e non mostra distanza o durata inventate.