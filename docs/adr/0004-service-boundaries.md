# ADR-0004: Adapter e confine server

Stato: accettato; nessun provider integrato. Data: 2026-10-26.

## Contesto e decisione

Separare tile, geocoding/ricerca, percorsi, meteo, dati sui luoghi, consigli,
LLM/visione, importazione, storage file, email e push dietro interfacce sostituibili.
Permessi browser e renderer hanno adapter distinti dai servizi remoti.
Le credenziali API restano solo sul server e fuori da Git e log.

## Contratto richiesto a ciascun adapter

- Timeout esplicito e cancellazione delle richieste quando possibile.
- Errori normalizzati: indisponibile, timeout, quota esaurita, vietato, dato assente.
- Retry limitati, solo se sicuri rispetto a idempotenza e consumo delle quote.
- Quote per utente e globali applicate atomicamente sul server, con stop prima
  del limite; contatori di richieste in corso, non solo chiamate gia' concluse.
- Cache solo per dati, durata e utilizzi consentiti; separare dati privati e comuni.
- Fallback esplicito e testabile, senza inventare risultati o chiamare un provider
  alternativo non approvato. La modifica manuale dei viaggi resta disponibile.

## Alternative e conseguenze

Chiamate SDK sparse nella UI renderebbero difficili sostituzione e controllo dei
costi. Un proxy indiscriminato non elimina limiti o vincoli di licenza dei provider.
Per ogni candidato verificare prima prezzi, quote, termini, cache/archiviazione,
attribuzione, trattamento dati e regione sulla documentazione ufficiale aggiornata.
Tali condizioni sono attualmente non verificato; confronto al passo 1.

Se un servizio richiede una chiave nel browser, non esporla per comodita': scegliere
una soluzione compatibile o riaprire esplicitamente il vincolo. Verificare che il
proxy server sia ammesso. Le chiavi pubbliche di protocollo non sono segreti API.
Non conservare risposte grezze per default; limitare dati personali e diagnostica.

## Fonti

Vincoli di progetto confermati dall'utente il 2026-10-26. Nessuna condizione di
fornitura verificata o accettata in questo ADR.