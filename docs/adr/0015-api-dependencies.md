# ADR-0015: Dipendenze API, validazione, password e migrazioni

Stato: accettato per il passo 4 locale. Verifica fonti: 2026-10-26.

## Decisione

Usare Fastify 5.12.7 per l'API REST, `pg` 8.23.1 per PostgreSQL,
`node-pg-migrate` 9.0.0 per lo schema e TypeBox 1.4.3 per produrre JSON Schema
con tipi TypeScript. Fastify/Ajv resta il validatore HTTP; gli schemi devono
essere definiti dal codice e avere `additionalProperties: false` dove opportuno.
Usare `argon2` 0.45.1 con Argon2id e parametri predefiniti della libreria per
password; non implementare primitive crittografiche proprie.

Cookie, CSRF e rate limit usano i plugin ufficiali Fastify `@fastify/cookie`
11.1.3, `@fastify/csrf-protection` 8.0.2 e `@fastify/rate-limit` 11.2.1.
Il plugin CSRF e' una componente, non una garanzia sufficiente: configurazione,
controllo Origin e test restano responsabilita' dell'applicazione. Il rate
limiter in memoria e' solo per singolo processo locale e non soddisfa un futuro
deployment multiistanza senza store condiviso.

## Licenze e compatibilita'

Fonti ufficiali consultate il 2026-10-26; versioni installate bloccate nel
manifest e nel lockfile. Tutti i pacchetti diretti elencati dichiarano MIT.

| Progetto | Versione | Evidenza verificata |
| --- | --- | --- |
| [Fastify](https://github.com/fastify/fastify) | 5.12.7 | MIT; release recente e CI Node 26; usa JSON Schema/Ajv |
| [node-postgres](https://github.com/brianc/node-postgres) | pg 8.23.1 | MIT; client JS con pooling e query parametrizzate; manutenzione recente |
| [node-pg-migrate](https://github.com/salsita/node-pg-migrate) | 9.0.0 | MIT; Node >=20.11 e PostgreSQL >=14; release recente |
| [TypeBox](https://github.com/sinclairzx81/typebox) | 1.4.3 | MIT; schemi JSON con tipi statici; release corrente supporta TypeScript 6–7 |
| [node-argon2](https://github.com/ranisalt/node-argon2) | 0.45.1 | MIT; Node >=22, Argon2id predefinito, test Node 26 e binari Windows documentati; verificare anche licenza upstream PHC inclusa |
| [@fastify/cookie](https://github.com/fastify/fastify-cookie) | 11.1.3 | MIT; compatibilita' Fastify 5 documentata, attributi cookie sicuri disponibili |
| [@fastify/csrf-protection](https://github.com/fastify/csrf-protection) | 8.0.2 | MIT; integrazione cookie documentata; disclaimer esplicito che la difesa resta responsabilita' dell'app |
| [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) | 11.2.1 | MIT; compatibilita' Fastify 5 documentata; store in memoria predefinito |

`@types/node` 26.6.5 e `@types/pg` 8.23.1 sono MIT e solo strumenti di tipo.
Non sono introdotti ORM, servizi gestiti, librerie di sessione o client provider.
Per i test SQL e' aggiunto `@electric-sql/pglite` 0.5.11, dual-licensed Apache-2.0
e PostgreSQL License. L'upstream e' molto attivo ma dichiara il progetto Alpha;
e' solo devDependency e non sostituisce il gate contro un server PostgreSQL reale.

## Conseguenze e limiti

Le versioni esatte riducono variazioni non intenzionali; ogni aggiornamento
richiede rivalutazione del lockfile e dei vincoli runtime. Argon2 installa un
modulo nativo: i binari Windows sono documentati, ma l'installazione e il test
locale restano gate. Node locale e' 26.12.1.

Non e' disponibile PostgreSQL o Docker in questo ambiente. Migrazione e repository
sono stati eseguiti su PGlite/PostgreSQL WASM, ma non su un server PostgreSQL
separato; non dichiarare il passo 4 completo finche' quel gate non viene eseguito.
Nessun hosting, provider email, servizio esterno o costo e' attivato. L'entry point
rifiuta l'avvio in produzione senza un adapter email.