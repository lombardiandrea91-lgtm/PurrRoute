# ADR-0001: Codice proprietario e riuso consentito

Stato: accettato. Data: 2026-10-26.

## Contesto e fatti

L'utente vuole un'app pubblica gratuita con codice privato e proprietario e
conferma di avere i diritti sul kit. Questa e' una dichiarazione dell'utente,
non una verifica legale indipendente. Il kit non include una licenza esplicita.

## Decisione

Scriviamo UI, dominio, account, permessi e sync. Non copiamo codice di progetti
di pianificazione viaggi. Ammettiamo librerie generiche con verifica individuale
di licenza e manutenzione in ADR prima di ogni adozione.
Nessuna licenza open source viene applicata al codice nostro.

## Alternative e conseguenze

Pubblicare il nostro codice con MIT o Apache-2.0 non corrisponde alla scelta
dell'utente. Le licenze permissive delle dipendenze restano applicabili: conservare
attribuzioni, testi LICENSE e NOTICE richiesti, anche negli artefatti distribuiti.
L'audit delle dipendenze transitive avverra' sul lockfile effettivo, ancora assente.
Il codice JavaScript client distribuito resta ispezionabile anche se proprietario.

Visibilita' del repository remoto: non verificato. Non pubblicare codice o
cambiare visibilita' senza consenso. Nessun push e nessun segreto nel repository.

## Fonti

Decisioni raccolte dall'utente il 2026-10-26; per le licenze dei progetti proposti
vedere [ADR-0002](0002-web-stack.md), [ADR-0003](0003-local-first.md) e
[ADR-0009](0009-map-renderer.md).