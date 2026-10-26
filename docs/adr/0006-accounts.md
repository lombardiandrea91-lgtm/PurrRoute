# ADR-0006: Email/password e ospite locale

Stato: accettato il modello; librerie da selezionare. Data: 2026-10-26.

## Contesto e decisione

Un account unico email/password per tutti i dispositivi. Uso locale consentito
senza account; niente sincronizzazione o condivisione cloud implicita dell'ospite.
La richiesta di accesso Google si riferisce a GitHub, non all'app.

## Alternative e conseguenze

Magic link, Google login e account obbligatorio non sono il modello selezionato.
Un servizio gestito non deve sostituire implicitamente la logica account nostra.
Usare comunque librerie generiche mantenute per hashing e protocolli: non
inventare crittografia o recupero password.

Prima del rilascio pubblico: verifica email, recupero password, sessioni revocabili,
cookie HttpOnly/Secure con politica SameSite appropriata, protezione CSRF e rate
limit. Verificare permessi server per ogni risorsa. Definire cancellazione account,
export JSON, logout e isolamento locale dei dati nel passo 4.

Non collegare identita' o trasferire viaggi ospite silenziosamente. Il consenso
deve chiarire quali dati locali entrano nell'account e come evitare duplicati.
Se l'email gratuita non e' disponibile, non eliminare verifica o recupero come
scorciatoia: riaprire il vincolo prima della pubblicazione.

## Fonti e non verificato

Modello confermato dall'utente il 2026-10-26. Libreria auth, hashing, driver,
provider email, dominio mittente e condizioni: non verificato. Selezione e ADR
prima dell'implementazione; nessuna dipendenza auth implicita in Fastify.