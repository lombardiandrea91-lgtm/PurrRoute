# Struttura del repository

Stato: scaffolding incrementale. Passo 4: dominio, contratti, API, repository e
migrazioni presenti; server PostgreSQL/email produzione restano da verificare.
Passo 5: core viaggi locale Dexie. Passo 6: MapLibre, OpenFreeMap e adapter API
geospaziali presenti; LocationIQ resta opt-in, ORS non selezionato. I due kit
restano nella root; i passi successivi si aggiungono quando partono.

```text
apps/
  web/                    # Client React/Vite, i18n IT/EN, PWA, storage locale
  api/                    # API, sessioni, permessi e adapter provider (passo 4)
packages/
  domain/                 # Tipi e regole pure del viaggio
  contracts/              # Contratti API, validazione runtime ed errori
  design-system/          # Token, SVG del kit, temi e font verificati
db/
  migrations/             # Migrazioni PostgreSQL
tests/
  e2e/                    # Flussi trasversali; unit test accanto ai moduli
docs/
  foundations.md
  repository-structure.md
  adr/                    # Decisioni numerate e fonti delle verifiche
infra/                    # Solo dopo scelta dell'hosting
.github/
  workflows/              # CI progressiva, nei passi pertinenti
README.md
```

## Responsabilita' e dipendenze

- `domain` non importa React, HTTP, database, SDK o segreti.
- `contracts` definisce il confine API validabile anche a runtime; puo' dipendere
  da tipi di dominio, mai dallo schema fisico del database o dal backend.
- `design-system` puo' usare React, ma non dipende dai servizi o dai dati del viaggio.
- `web` usa dominio, contratti e design system. Accede a IndexedDB e al renderer
  mappa tramite moduli dedicati; non importa codice server o credenziali.
- `api` usa dominio e contratti e ospita adapter di dati, autenticazione,
  infrastruttura e servizi. Le autorizzazioni sono applicate qui, non solo in UI.
- `web` e `api` non si importano reciprocamente; comunicano attraverso l'API.
- `db/migrations` e' autorita' delle modifiche allo schema condiviso.

Le interfacce degli adapter appartengono al modulo che le usa, vicino ai casi
d'uso; non creare un pacchetto generico di astrazioni prima che serva.
API REST modulare e npm workspaces; niente microservizi o orchestratore monorepo.

## Evoluzione e verifica

Al passo 2 nasce il design system. Al passo 3 nasce il client PWA; al passo 4
backend e schema; al passo 5 il nucleo locale; al passo 7 la sync completa.
IDs stabili, revisioni, cancellazioni e idempotenza vanno considerati prima della
sync, senza implementare prematuramente la politica dei conflitti.

Le versioni backend sono registrate in ADR-0015; le scelte degli altri moduli
restano nei rispettivi ADR. I file ambiente server non entrano nel repository;
gli esempi contengono soltanto credenziali locali fittizie, mai segreti reali.