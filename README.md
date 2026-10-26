# purrRoute

Web app per pianificare viaggi personali e condivisi, con Gatto rosso e Gatta cipria.
Un solo client web, installabile come PWA su Android; distribuzione TWA prevista.
Codice proprietario. App pubblica gratuita, inizialmente per circa 10 utenti attivi.

## Stato

Passi 0, 1 e 2 completati. Shell del passo 3 verificata localmente; Android/HTTPS
reali ancora da provare. Il passo 4 è implementato e testato su PostgreSQL embedded;
server PostgreSQL reale e email di produzione restano da verificare. Passo 5
implementato local-first con Dexie. Passo 6 implementato e verificato localmente
come MVP:
MapLibre/OpenFreeMap, pin, cluster, selezione lista↔mappa e inserimento manuale di
coordinate. Geocoding/routing LocationIQ restano opt-in con verifica privacy/termini
aperta; ORS non è selezionato. Mappe offline e sincronizzazione restano al passo 7.
Dal 2026-10-26 l'utente autorizza a procedere senza approvazioni intermedie,
preservando ordine dei passi, budget e vincoli.

- [Fondamenta e questioni aperte](docs/foundations.md)
- [Struttura del repository](docs/repository-structure.md)
- [Ricerca servizi esterni](docs/service-selection.md)
- [Design system e verifiche](docs/design-system.md)
- [Anteprima componenti](packages/design-system/preview.html)
- [Shell PWA: avvio e verifiche](docs/pwa-shell.md)

## Decisioni architetturali

| ADR | Decisione |
| --- | --- |
| [0001](docs/adr/0001-ownership.md) | Codice proprietario e riuso consentito |
| [0002](docs/adr/0002-web-stack.md) | Monorepo TypeScript, React/Vite e Node/Fastify |
| [0003](docs/adr/0003-local-first.md) | PostgreSQL e IndexedDB con Dexie core |
| [0004](docs/adr/0004-service-boundaries.md) | Adapter, segreti, quote e fallback |
| [0005](docs/adr/0005-budget-hosting.md) | Budget zero e hosting UE da verificare |
| [0006](docs/adr/0006-accounts.md) | Email/password e ospite locale |
| [0007](docs/adr/0007-design-languages.md) | Kit autorevole, 14 categorie e IT/EN |
| [0008](docs/adr/0008-optional-ai.md) | AI opzionale e minimizzazione dati |
| [0009](docs/adr/0009-map-renderer.md) | MapLibre separato dai servizi cartografici |
| [0010](docs/adr/0010-pwa-twa.md) | PWA prima, TWA dopo |
| [0011](docs/adr/0011-service-shortlist.md) | Shortlist servizi e blocchi prima dell'integrazione |
| [0012](docs/adr/0012-design-tooling.md) | Estrazione kit, font locale e strumenti design |
| [0013](docs/adr/0013-pwa-shell.md) | Shell React, routing, precache e accessibilita' |
| [0014](docs/adr/0014-domain-model.md) | Modello dominio per viaggi e tappe |
| [0015](docs/adr/0015-api-dependencies.md) | Dipendenze API, validazione, password e migrazioni |
| [0016](docs/adr/0016-local-trip-storage.md) | Archivio locale viaggi e scheduling tappe |
| [0017](docs/adr/0017-maps-and-location-services.md) | Renderer, tile, geocoding e routing |

## Consultazione e avvio

Aprire l'anteprima componenti direttamente nel browser, senza server.
Per rigenerare e verificare il design system:

```powershell
npm ci
npm run assets
npm run check
npm test
npm run test:design
```

La verifica della preview componenti usa Microsoft Edge installato;
`PLAYWRIGHT_CHANNEL` permette di selezionare un altro canale disponibile.

Per usare la shell PWA, dalla root:

```powershell
npm ci
npm run check
npm test
npm run build
npm run test:pwa
npm run preview --workspace @purrroute/web -- --host 127.0.0.1 --port 4173 --strictPort
```

Aprire <http://127.0.0.1:4173/>. Se la porta e' occupata, scegliere un'altra porta.
Per sviluppo con ricaricamento automatico usare `npm run dev`; il service worker
e' attivo solo nella build di produzione. La shell richiede Node con supporto
type stripping per i test TypeScript (ambiente verificato: Node 26.12.1).

Per usare l'API account in locale serve PostgreSQL 14 o successivo gia' installato
e in esecuzione. Copiare `apps/api/.env.example` in `apps/api/.env`, adattare le
credenziali esclusivamente locali, poi dalla root:

```powershell
npm run migrate --workspace @purrroute/api
npm run dev --workspace @purrroute/api
```

L'API ascolta su `http://127.0.0.1:3000`; l'origine web consentita predefinita e'
`http://localhost:5173`. In sviluppo, `GET /api/dev/mail` restituisce i token
monouso per verifica e reset: il sink e' in memoria, solo locale e non adatto alla
produzione. L'avvio con `NODE_ENV=production` fallisce intenzionalmente finche' non
esiste un adapter email reale verificato. Nessun provider remoto e' attivato.
Typecheck e test embedded non sostituiscono il gate con un server PostgreSQL reale.

Il [kit HTML](purrRoute%20%E2%80%93%20kit%20completo%20%28v5%29.html)
si apre direttamente nel browser, senza server; carica il font da Google Fonts.
Il [kit Markdown](purrRoute%20%E2%80%93%20kit%20completo%20%28v5%29.md)
e' descrittivo e non contiene un secondo insieme di asset SVG.
I due originali sono preservati, compreso il refuso sul numero delle categorie.

## Verifica manuale

- Confermare budget API e hosting di 0 EUR/mese e stop alle quote gratuite esaurite.
- Confermare italiano e inglese, email/password e uso locale senza account.
- Verificare la separazione tra fatti, ipotesi e decisioni aperte nelle fondamenta.
- Aprire tutti i 17 ADR e controllare motivazioni, alternative, conseguenze e fonti.
- Aprire Mappa, selezionare un viaggio, controllare pin/cluster e provare selezione
	lista↔mappa e inserimento manuale da click.
- Verificare che tile non siano in cache service worker e che LocationIQ resti
	disattivato senza opt-in e chiave server.

Il passo 2 aggiunge test di SVG, PNG, font, contrasto e anteprima responsive;
il passo 3 aggiunge test di preferenze, traduzioni e contratto PWA.
Restano aperte la fattibilita' del costo zero,
le condizioni dei provider e i requisiti correnti di Google Play.

## Protocollo

Un passo alla volta. Prima: obiettivo, piano breve e domande aperte. Dopo:
risultato, avvio o consultazione, checklist manuale, test eseguiti, rischi, ADR e
commit. Proseguire senza attendere OK, come autorizzato dall'utente il 2026-10-26.
Riaprire le decisioni se richiedono di cambiare vincoli espliciti.
Nessun push e nessun pagamento automatico.

Il repository remoto indicato dall'utente e'
<https://github.com/lombardiandrea91-lgtm/PurrRoute.git>.
Accesso, contenuti e visibilita' non verificati; nessuna connessione implicita.