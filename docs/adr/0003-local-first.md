# ADR-0003: PostgreSQL e IndexedDB local-first

Stato: accettato come direzione; schema e sync da progettare. Data: 2026-10-26.

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
| [Dexie core](https://github.com/dexie/Dexie.js) | Apache-2.0 | Commit e release recenti; addon observable/syncable dichiarati legacy e non mantenuti |

Conservare gli avvisi di licenza e NOTICE applicabili. Dexie core non implica
adozione di servizi cloud o addon. Driver PostgreSQL e librerie di migrazione:
non verificato, da selezionare separatamente. IndexedDB e' un'API browser, non
un servizio esterno ne' una garanzia di persistenza illimitata.

## Alternative e conseguenze

Solo server impedirebbe l'uso offline; solo browser non permetterebbe una copia
condivisa e controlli di accesso autorevoli. Una piattaforma sync esterna
contrasterebbe con la scelta di possedere la logica applicativa.

Il nucleo locale arriva al passo 5; sync e conflitti al passo 7. Considerare
IDs stabili, revisioni, tombstone e idempotenza gia' nei contratti dei passi 4 e 5.
Non promettere merge automatici prima di definirne la politica.
IndexedDB puo' subire cancellazione o eviction: non e' backup. Gestire quota,
export e isolamento locale tra ospite e account. Il trasferimento dei viaggi
ospite all'account richiede conferma esplicita. Il server ricontrolla ogni permesso.