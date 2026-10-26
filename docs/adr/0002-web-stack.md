# ADR-0002: Monorepo TypeScript e piattaforma web unica

Stato: accettato come direzione; nessuna dipendenza installata. Data: 2026-10-26.

## Contesto

Serve un client web responsive offline-capable, condiviso tra browser desktop e
Android, e un backend nostro. Il carico iniziale dichiarato e' circa 10 utenti.

## Decisione

TypeScript strict, React con Vite, Node.js LTS con Fastify e API REST modulari.
Monorepo npm workspaces con dominio e contratti separati; nessun orchestratore
aggiuntivo. UI e CSS derivano dal kit, senza framework visuale sostitutivo.

## Verifica licenze e manutenzione

Fonti ufficiali consultate il 2026-10-26. Evidenze qualitative di attivita' upstream,
non una garanzia di supporto della versione che installeremo.

| Progetto e fonte ufficiale | Licenza dichiarata | Evidenza osservata |
| --- | --- | --- |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Commit e release recenti |
| [React](https://github.com/facebook/react) | MIT | Commit recenti e release nell'ottobre 2026 |
| [Vite](https://github.com/vitejs/vite) | MIT | Commit e release recenti |
| [Node.js](https://github.com/nodejs/node) | MIT e licenze dei componenti inclusi | Commit e release di manutenzione recenti |
| [Fastify](https://github.com/fastify/fastify) | MIT | Commit e release recenti; ramo main distinto dalla stabile |

Conservare licenze, copyright e NOTICE richiesti. Controllare anche le licenze
incluse in Node e quelle transitive dei pacchetti effettivamente bloccati.
Compatibilita' delle versioni, versione npm inclusa e requisiti runtime:
non verificato. Fissare versioni stabili supportate prima dell'installazione,
senza adottare automaticamente main, nightly o Node Current.

## Alternative e conseguenze

Un framework SSR aggiungerebbe funzionalita' non necessarie al nucleo interattivo;
eventuali pagine pubbliche indicizzabili richiederanno una valutazione separata.
Microservizi e client nativo separato aumenterebbero il costo di manutenzione.
Fastify offre validazione JSON Schema e composizione modulare, ma non sostituisce
il progetto di autenticazione, autorizzazione o gestione degli errori.

Routing, i18n, PWA, test, auth e driver DB saranno verificati prima del loro uso.
Non sono dipendenze gia' approvate per il solo fatto di appartenere all'ecosistema.