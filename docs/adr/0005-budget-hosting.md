# ADR-0005: Budget zero e hosting gestito UE

Stato: accettato il vincolo; fornitore non scelto. Data: 2026-10-26.

## Fatti e decisione

L'utente ha fissato 0 EUR/mese per API e, separatamente, 0 EUR/mese per hosting,
database, file, backup e monitoraggio. Preferisce hosting gestito UE.
Solo piani gratuiti compatibili, senza upgrade o addebiti automatici.
Quote esaurite: sospendere l'integrazione, non attivare pagamenti; preservare
il nucleo manuale locale. Nessuna carta o sottoscrizione attivata da questo passo.

## Ipotesi e non verificato

Circa 10 utenti potrebbero rientrare in quote gratuite, ma la fattibilita' di
Node/PostgreSQL gestiti in UE con backup e servizio continuativo e' non verificato.
Prezzi, durata dei free tier, limiti commerciali e regioni dei provider:
non verificato. Preferenza UE non equivale a trattamento esclusivamente UE.
Controllare anche file, copie, backup, log, supporto e subprocessori.

## Alternative e conseguenze

Un VPS comporterebbe amministrazione e possibili costi, non e' la scelta iniziale.
Un provider a pagamento o una regione diversa richiederebbero nuova approvazione.
Se nessuna opzione gratuita rispetta i vincoli, proseguire solo in locale e
riaprire la decisione; non cambiare implicitamente stack, privacy o budget.

Sospensioni, cold start, perdita di quote e backup assenti sono rischi concreti
dei piani gratuiti da valutare prima di ospitare dati reali. Non promettere SLA.
Dominio e pubblicazione Play sono separati: costi correnti non verificato,
nessuna autorizzazione a pagarli. Nessun provider viene scelto nel passo 0.

## Fonti

Risposte dell'utente del 2026-10-26. Ricerca ufficiale delle offerte e dei termini
rinviata al passo 1, prima di qualsiasi integrazione.