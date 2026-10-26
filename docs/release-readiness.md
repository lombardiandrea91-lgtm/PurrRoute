# Release Readiness

Stato al 2026-10-26: **non pronto per una release pubblica**. I passi 0–12
hanno MVP locali; il passo 13 ha solo il preflight TWA. Nessun hosting, account
provider, dominio, pagamento, chiave o pubblicazione è stato attivato.

## Gate locali passati

- `npm run assets`
- `npm run check`
- `npm test`: 60 test, 0 fallimenti al passo 13
- `npm run build`
- `npm run test:pwa`
- `npm run test:design`: Edge desktop/mobile, temi chiaro/scuro
- `npm audit --audit-level=high`: 0 vulnerabilità note alla data del controllo
- HTTP preview: route SPA `/settings` ha restituito 200 sulla porta 4174
- `npm audit --audit-level=high`: 0 vulnerabilità note al momento del controllo
- `git diff --check`

Il runtime eval plan è presente in `.tsupgrader/runtime-validation/eval-plan.json`.
La sua esecuzione standalone si è fermata nel setup `npm ci`: Windows ha restituito
`EPERM` tentando di rimuovere il binding Rolldown caricato dal dev server. Il
server condiviso non è stato terminato. Dopo il ripristino delle dipendenze con
`npm install --ignore-scripts`, i singoli assertion locali del piano sono stati
rieseguiti; la validazione standalone resta formalmente incompleta.

## Da implementare o decidere

- **Produzione account:** scegliere e configurare un adapter email verificato per
  attivazione account e reset password. Il server rifiuta intenzionalmente l'avvio
  production senza delivery email reale.
- **TWA:** scegliere dominio HTTPS e application ID, definire la strategia di
  firma, ottenere la fingerprint del certificato di app-signing e creare il
  wrapper Bubblewrap. Non esistono APK/AAB o file `assetlinks.json` di produzione.
- **Posizione/notifiche:** l'MVP funziona solo mentre la mappa è visibile. Web Push
  in background, iscrizioni, VAPID, scheduler e pulizia delle subscription non
  sono implementati. Decidere se sono requisiti del primo rilascio.
- **Inviti collaborazione:** l'owner concede accesso immediato a un account già
  verificato. Invito con accettazione, notifica email e abbandono volontario del
  viaggio non sono implementati.
- **Documenti viaggio:** storage file e cifratura/recovery/trasferimento chiavi
  non sono implementati; non presentare allegati come funzione disponibile.
- **Hosting e operazioni:** scegliere hosting/database/backup compatibili col
  budget, automatizzare CI/release se richiesto e definire restore, retention,
  monitoraggio e procedura incidenti. Nessun deployment è configurato.

## Da verificare prima del rilascio

- Applicare migrazioni 001–006 e avviare l'API su PostgreSQL reale; provare account,
  export/cancellazione, push/pull/conflitti e ACL owner/editor/viewer con più account.
- Verificare email reale end-to-end, deliverability, mittente, quote, DPA e flussi
  di verifica/reset senza esporre token.
- Pubblicare su HTTPS controllato; eseguire `npm run check:twa` con origine,
  application ID e certificato reali; controllare separatamente la configurazione
  Play App Signing e i requisiti Play/Data safety correnti.
- Installare il TWA firmato su Android fisico; verificare Digital Asset Links,
  fallback Custom Tab, routing, login/cookie, back, aggiornamento e offline.
- Provare su dispositivi/browser reali permessi posizione/notifica, stop quando
  l'app è nascosta, consumo batteria e limiti foreground-only. Nessun test GPS o
  notifica reale è stato eseguito.
- Eseguire prove di accessibilità dell'intera app con screen reader, tastiera e
  zoom 200%; i test axe/design coprono solo superfici selezionate.
- Eseguire test di carico/concorrenza essenziali e un restore da backup reale.
- Chiudere verifica privacy/termini per provider, regione/retention, informativa,
  responsabilità sui dati e policy di cancellazione prima di attivare servizi.

## Comando TWA

Il preflight legge solo il sito indicato da `TWA_ORIGIN`, più
`/manifest.webmanifest` e `/.well-known/assetlinks.json`; non genera chiavi o
pacchetti. Senza prerequisiti fallisce intenzionalmente con una causa esplicita.
Dettagli e fonti: [ADR-0024](adr/0024-google-play-twa-readiness.md).