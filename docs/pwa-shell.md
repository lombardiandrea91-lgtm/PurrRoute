# Shell PWA

Passo 3 implementato il 2026-10-26. Gate locali passati; installazione Android
reale e pubblicazione HTTPS non verificate. Non e' ancora l'MVP del passo 6.

## Come avviarla

Dalla root, Node con type stripping (verificato 26.12.1) e npm:

```powershell
npm ci
npm run check
npm test
npm run build
npm run test:pwa
npm run preview --workspace @purrroute/web -- --host 127.0.0.1 --port 4173 --strictPort
```

Aprire <http://127.0.0.1:4173/>. Se 4173 e' occupata, cambiare porta; non terminare
processi altrui. `npm run dev` avvia invece Vite per sviluppo senza service worker.
`prepare-web` copia icone e OFL dai sorgenti versionati prima di dev/build; le
copie e la directory dist non vanno modificate manualmente.

## Funzioni effettive e limiti

- Route `/trips`, `/map`, `/offline`, `/settings`, redirect iniziale e pagina 404.
- Sidebar e pannelli affiancati desktop; bottom navigation sotto 680 px.
- Preferenze IT/EN, tema sistema/chiaro/scuro e gatto persistite con validazione
  e gestione di localStorage non disponibile. Aggiornamento tra tab via storage.
- Focus sull'intestazione al cambio route, skip link, form nativi con label,
  fieldset, radio, focus visibile e riduzione movimento.
- Rete disponibile e capacita' offline della shell indicate separatamente;
  `navigator.onLine` non certifica raggiungibilita' del backend o sincronizzazione.
- Manifest con id/scope stabili, any 192/512, maskable e monocromatica 512;
  favicon segue il gatto, icona installazione predefinita resta il gatto rosso.
- Installazione proposta solo quando il browser rende disponibile l'evento;
  aggiornamento SW su comando esplicito, niente refresh forzato silenzioso.
- Shell e asset nostri in precache Workbox; route SPA disponibili offline dopo
  prima visita completa, pagina statica `/offline.html` disponibile anche da sola.
- Nessun tile, API o documento in cache runtime. `/api` e `/api/*` sono esclusi
  dal fallback del service worker; la preview Vite non e' un server API.

La mappa mostra indisponibilita', non una mappa o percorso simulati. Non ci sono
viaggi, account o modifiche sincronizzate: il contatore e' realmente zero. Queste
funzioni appartengono ai passi successivi e non sono rappresentate da pulsanti
che fingono di funzionare. La scelta grafica del gatto non cambia la categoria
dei futuri dati viaggio o la decisione ancora aperta sugli stati.

## Verifiche eseguite

- TypeScript strict, build Vite e Workbox: passati.
- Nove test Node: inventario kit, SVG, PNG, font, contrasto semantico,
  validazione preferenze e chiavi IT/EN.
- Contratto build PWA: manifest, icone e relativi file, SW, offline e OFL passati.
- Piano standalone: 7 asserzioni passate, nessun fallimento. Il parser non
  interpreta il conteggio Node: esecuzione diretta conferma 9 test passati.
- Browser integrato Chromium: lingua inglese, tema scuro e cipria mantenuti
  dopo reload; poi cambio lingua/tema tramite UI e navigazione verificati.
- A 390x844: nessun overflow orizzontale, bottom navigation visibile, font locale
  caricato. A 1440x1000: sidebar e due pannelli, nessun overflow.
- Con rete disabilitata nel browser: reload e navigazione a Offline riusciti,
  service worker controllante e stato shell offline disponibile.
- CDP `Page.getInstallabilityErrors`: lista vuota nel browser locale.
- axe A/AA e WCAG 2.1 AA sulle impostazioni mobile: 0 violazioni, 20 regole passate.
  Non e' una certificazione manuale WCAG dell'intera app.
- Screenshot mobile e desktop controllati nel browser integrato; screenshot
  automatici del design system disponibili nei risultati locali.

La registrazione E2E automatica proposta dallo strumento e' fallita per agente
`JSTS Playwright Spec Author` non disponibile: richiesta annullata e browser
temporaneo chiuso. Nessuna spec inventata o promossa. Il piano usa il fallback
HTTP documentato, piu' debole di un flusso browser registrato. I controlli nel
browser integrato sono evidenza della sessione, non spec CI riproducibile.

La documentazione Chrome dichiara deprecati gli audit PWA Lighthouse: non
dichiariamo un badge PWA verde. Lighthouse performance, Core Web Vitals reali e
Android fisico non eseguiti. Build corrente: circa 610 KiB di precache statico.
Il bundler ha segnalato una dipendenza transitoria glob deprecata durante install;
npm non ha segnalato vulnerabilita' note, senza garanzia di assenza di rischi.

## Checklist manuale

- Aprire la shell desktop e mobile; passare tra le quattro route e provare back.
- Cambiare lingua, tema e gatto; ricaricare e controllare la persistenza.
- Navigare con Tab, radio con frecce e skip link; verificare il focus.
- Dopo caricamento completo, disabilitare rete e ricaricare `/trips` e `/settings`.
- Controllare Offline: shell disponibile non deve essere confusa con mappe scaricate.
- Su hosting HTTPS, provare installazione Android, avvio dalla home e offline.
- Verificare lettore di schermo e zoom 200% prima del rilascio pubblico.

## Blocco esterno e prossimi passi

Non esistono dominio/hosting configurati o account provider. La verifica Android
da un telefono richiede un'origine HTTPS pubblica o un ambiente HTTPS di test
attendibile sul dispositivo; l'URL localhost del PC non e' quello del telefono.
Nessun hosting viene attivato automaticamente e nessun budget modificato.

Prima di pubblicare backend/account occorrono PostgreSQL accessibile, policy
backup e un mittente email verificato; non omettere verifica email o recupero
password come scorciatoia. Questo documento non cambia l'ordine dei passi e
non autorizza servizi della shortlist con condizioni ancora non verificate.
ADR: [0013](adr/0013-pwa-shell.md). Nessun push o costo attivato.