# purrRoute

Web app per pianificare viaggi personali e condivisi, con Gatto rosso e Gatta cipria.
Un solo client web, installabile come PWA su Android; distribuzione TWA prevista.
Codice proprietario. App pubblica gratuita, inizialmente per circa 10 utenti attivi.

## Stato

Passo 0: fondamenta decisionali documentate il 2026-10-26, sulla base della
proposta approvata dall'utente. Nessuna applicazione, dipendenza o integrazione
installata. Il passo 1 richiede un nuovo OK esplicito.

- [Fondamenta e questioni aperte](docs/foundations.md)
- [Struttura del repository](docs/repository-structure.md)

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

## Consultazione e avvio

Aprire questo documento in anteprima Markdown di VS Code. Non esistono ancora
comandi di avvio, build o test dell'app: non eseguire installazioni per il passo 0.
Il [kit HTML](purrRoute%20%E2%80%93%20kit%20completo%20%28v5%29.html)
si apre direttamente nel browser, senza server; carica il font da Google Fonts.
Il [kit Markdown](purrRoute%20%E2%80%93%20kit%20completo%20%28v5%29.md)
e' descrittivo e non contiene un secondo insieme di asset SVG.
I due originali sono preservati, compreso il refuso sul numero delle categorie.

## Verifica manuale del passo 0

- Confermare budget API e hosting di 0 EUR/mese e stop alle quote gratuite esaurite.
- Confermare italiano e inglese, email/password e uso locale senza account.
- Verificare la separazione tra fatti, ipotesi e decisioni aperte nelle fondamenta.
- Aprire i dieci ADR e controllare motivazioni, alternative, conseguenze e fonti.
- Verificare che non siano stati aggiunti codice applicativo o servizi esterni.

I controlli automatici di questo passo riguardano documenti e collegamenti locali,
non comportamento applicativo. Restano aperte la fattibilita' del costo zero,
le condizioni dei provider e i requisiti correnti di Google Play.

## Protocollo

Un passo alla volta. Prima: obiettivo, piano breve e domande aperte. Dopo:
risultato, avvio o consultazione, checklist manuale, test eseguiti, rischi, ADR e
commit. Poi fermarsi in attesa di OK. Nessun push e nessun pagamento automatico.

Il repository remoto indicato dall'utente e'
<https://github.com/lombardiandrea91-lgtm/PurrRoute.git>.
Accesso, contenuti e visibilita' non verificati; nessuna connessione implicita.