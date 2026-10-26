# ADR-0008: AI opzionale e minimizzazione dati

Stato: accettato; nessun provider scelto. Data: 2026-10-26.

## Contesto e decisione

AI, visione e consigli generati sono funzioni opzionali con feature flag server,
inizialmente disattivate. L'app deve funzionare con AI e consigli spenti: nessun
flusso manuale richiede un LLM. La UI riflette le capacita' effettivamente abilitate.

## Alternative e conseguenze

Un nucleo AI-first renderebbe costi e disponibilita' esterni essenziali e non
rispetterebbe i vincoli. La sola disattivazione grafica non basta: il server deve
bloccare richieste alle funzioni disabilitate e non inizializzarle obbligatoriamente.

Minimizzare i dati inviati, richiedere consenso esplicito prima di inviare screenshot
a terzi; nessuna bozza importata salvata automaticamente. Metadati Open Graph e
JSON-LD precedono l'AI. Recupero URL lato server con protezione SSRF e rispetto
di robots e termini; dettagli e casi di errore al passo 10.
Quote per utente e globali, contatori costi, timeout e fallback manuale sono
obbligatori anche se il piano si presenta come gratuito.

## Fonti e non verificato

Vincoli utente del 2026-10-26. Costi, quote, trattamento UE, uso per training e
zero retention dei provider: non verificato. Prima di abilitare visione, verificare
che la configurazione e il contratto garantiscano la non conservazione richiesta;
se non possibile, non abilitare la funzione senza una nuova decisione esplicita.
Il consenso non sostituisce gli obblighi di sicurezza o la verifica contrattuale.