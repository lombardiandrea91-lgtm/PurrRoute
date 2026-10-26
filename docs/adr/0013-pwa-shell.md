# ADR-0013: Shell React, routing e cache PWA

Stato: accettato per il passo 3. Data: 2026-10-26.

## Decisione

Client React/Vite, React Router in modalita' libreria, navigazione inferiore su
mobile e sidebar con pannelli desktop. Nessuna demo di viaggi o sync fittizia.
Preferenze locali per lingua IT/EN, tema e gatto, senza account obbligatorio.
Cache solo della shell e degli asset nostri. Mai precache di API, documenti,
tile o dati privati; queste politiche appartengono ai rispettivi adapter.

Vite PWA con Workbox genera il service worker; aggiornamenti su conferma per
evitare ricaricamenti che in futuro perderebbero modifiche non salvate.
Manifest stabile, icone any/maskable/monochrome, pagina offline, HTTPS necessario
fuori localhost. Installazione proposta solo se il browser espone l'evento adatto.

## Licenze e manutenzione

Fonti ufficiali consultate il 2026-10-26; versioni effettive nel lockfile.

| Progetto | Licenza e manutenzione osservata |
| --- | --- |
| React e react-dom | MIT, upstream React gia' verificato in ADR-0002 |
| Vite | MIT, upstream gia' verificato in ADR-0002 |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT, commit recenti |
| [react-router](https://github.com/remix-run/react-router) | MIT, commit e release recenti |
| [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) | MIT, commit e release recenti |
| [Workbox](https://github.com/GoogleChrome/workbox) | MIT, release 7.4.1 e attivita' recente; ownership Aurora documentata |
| [@types/react e @types/react-dom](https://github.com/DefinitelyTyped/DefinitelyTyped) | MIT, repository attivo; dichiarazioni non codice applicativo |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | MPL-2.0, commit e release recenti; solo test, conservare licenza e obblighi dei file coperti se redistribuiti/modificati |

Preservare avvisi delle dipendenze transitive negli artefatti. I tool di sviluppo
non diventano servizi esterni in produzione. Linter dello scaffold non adottato.

## Alternative, verifica e limiti

Service worker scritto da zero evita dipendenze ma aumenta i rischi di cache e
aggiornamento; preferito Workbox. Il router non implementa autorizzazioni server.

La documentazione Chrome segnala che
[gli audit PWA Lighthouse sono deprecati](https://developer.chrome.com/docs/lighthouse/pwa/).
Non dichiarare un badge PWA verde inesistente: verificare manifest, controllo SW,
avvio offline e installabilita' con gli strumenti correnti. Lighthouse performance
e accessibilita' restano gate distinti; axe non certifica WCAG AA completa.
Installazione Android reale e HTTPS pubblico non verificati da test su localhost.