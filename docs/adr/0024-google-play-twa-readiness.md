# ADR-0024: Prontezza TWA e gate Google Play

Stato: preflight verificabile implementato; progetto Android e pubblicazione
bloccati da prerequisiti esterni. Data: 2026-10-26.

## Decisione

La PWA resta il prodotto di riferimento. Il passo 13 non crea un wrapper Android
con dominio, `applicationId` o certificato inventati e non genera chiavi private.
Dominio/hosting HTTPS e account Play Console non sono disponibili e i relativi
costi non sono autorizzati. In questa workspace non risultano progetto Android,
JDK, Android SDK/ADB o Bubblewrap.

È stato aggiunto `npm run check:twa`, un preflight manuale che, dopo la pubblicazione
del sito e la configurazione delle variabili, legge la Web Manifest pubblicata e
`https://<origin>/.well-known/assetlinks.json`. Verifica che l'origine sia HTTPS,
che `applicationId` e fingerprint SHA-256 siano formattati correttamente, che la
manifest abbia display installabile, start URL e scope coerenti e icone PNG 192/512,
e che Digital Asset Links deleghi `common.handle_all_urls` alla stessa app e al
certificato configurato. Il preflight rifiuta redirect e ha timeout di rete.

Variabili richieste: `TWA_ORIGIN`, `TWA_APPLICATION_ID` e
`TWA_SHA256_CERT_FINGERPRINT`. La fingerprint deve appartenere al certificato che
firma l'app distribuita. Se Play App Signing è attivo, verificare la fingerprint
della app-signing key di Play, non confonderla con la upload key o la chiave usata
per una build locale.

## Flusso dopo lo sblocco

1. Decidere/registrare il dominio HTTPS e confermare separatamente i costi di
   dominio, hosting e Play Console.
2. Scegliere definitivamente il package/application ID e la strategia di firma.
3. Pubblicare la PWA e Digital Asset Links nella posizione esatta
   `/.well-known/assetlinks.json` del dominio.
4. Eseguire `npm run check:twa` con le tre variabili impostate; risolvere ogni
   errore prima di inizializzare il wrapper.
5. Installare/validare JDK, Android SDK/ADB e una release corrente Bubblewrap
   sulla workstation; inizializzare il wrapper dalla manifest pubblicata.
6. Provare APK/AAB firmato su device Android fisico, verificare Chrome/TWA e
   fallback Custom Tab, link esterni, login/cookie, back navigation, offline,
   geolocation/notification permissions e comportamento dei link di ritorno.
7. Verificare requisiti Play, privacy/Data safety, scheda store e signing al
   momento del rilascio. Nessun upload è incluso in questo passo.

## Fonti e verifiche

- [Digital Asset Links: Getting Started](https://developers.google.com/digital-asset-links/v1/getting-started), consultato 2026-10-26: la statement list è pubblica e va servita all'esatto path `/.well-known/assetlinks.json`; l'esempio associa relation, namespace, package ID e fingerprint SHA-256.
- [Chrome TWA overview](https://developer.chrome.com/docs/android/trusted-web-activity/), consultato 2026-10-26. La pagina è datata 2020; le procedure operative e compatibilità correnti vanno ricontrollate prima di creare il pacchetto.
- [Chrome TWA quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), consultato 2026-10-26. La pagina è datata 2019; non viene usata come fonte sufficiente per versioni/toolchain Play correnti.

Test unitari mocked coprono validazione URL/app ID/fingerprint, manifest, scope,
icone, relation/certificato e gestione di errori/redirect. Il comando live è stato
eseguito senza configurazione e si è fermato correttamente su `TWA_ORIGIN` mancante.
Nessun dominio è stato contattato, nessuna chiave è stata generata e nessun costo
o account è stato attivato.