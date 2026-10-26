# ADR-0003: PostgreSQL e IndexedDB local-first

Stato: accettato; schema nel passo 4, sync MVP owner-only nel passo 7 (ADR-0018).
Data: 2026-10-26.

## Contesto e decisione

Viaggi utilizzabili localmente, anche senza account; un unico archivio condiviso
per gli account su piu' dispositivi. PostgreSQL sul server; IndexedDB tramite
Dexie core sul client. Repository di dominio indipendenti da storage e trasporto.
Scriviamo la sincronizzazione; non adottiamo Dexie Cloud.

## Verifica licenze e manutenzione

Fonti ufficiali consultate il 2026-10-26.

| Progetto | Licenza dichiarata | Evidenza e limiti |
| --- | --- | --- |
| [PostgreSQL](https://www.postgresql.org/about/licence/) | PostgreSQL License | Pagina ufficiale con attivita' di release nell'ottobre 2026; supporto della versione scelta: non verificato |
| [Dexie core](https://github.com/dexie/Dexie.js) | 4.4.7, Apache-2.0 | Release nell'ottobre 2026; addon observable/syncable legacy non adottati |

Conservare gli avvisi di licenza e NOTICE applicabili. Dexie core non implica
adozione di servizi cloud o addon. Driver `pg` e `node-pg-migrate` sono selezionati
e verificati in ADR-0015; il loro funzionamento contro un server PostgreSQL reale
resta da provare. IndexedDB e' un'API browser, non un servizio esterno ne' una
garanzia di persistenza illimitata.

## Alternative e conseguenze

Solo server impedirebbe l'uso offline; solo browser non permetterebbe una copia
condivisa e controlli di accesso autorevoli. Una piattaforma sync esterna
contrasterebbe con la scelta di possedere la logica applicativa.

Il nucleo locale arriva al passo 5; il passo 7 aggiunge snapshot owner-only,
versione server per viaggio, tombstone, coda locale derivata dalle revisioni e
risoluzione esplicita 409 senza merge. L'idempotenza dei retry non è ancora garantita.
IndexedDB puo' subire cancellazione o eviction: non e' backup. Gestire quota,
export e isolamento locale tra ospite e account. Il trasferimento dei viaggi
ospite all'account richiede conferma esplicita. Il server ricontrolla ogni permesso.