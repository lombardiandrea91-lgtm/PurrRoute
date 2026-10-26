# Design system dal kit v5

Passo 2 completato il 2026-10-26. Nessun servizio esterno attivo nella preview.
Font e immagini sono locali. I due kit originali sono versionati senza modifiche
per permettere rigenerazione anche dopo un clone.

## Consultazione e comandi

Aprire [l'anteprima HTML](../packages/design-system/preview.html) direttamente
nel browser. Tema sistema/chiaro/scuro e scelta del gatto per gli asset sono
interattivi; ogni PNG si puo' aprire o scaricare. Non serve un server.

```powershell
npm ci
npm run assets
npm run check
npm test
npm run test:design
```

La generazione scarica font e OFL da una revisione Google Fonts fissata solo se
assenti. Gli originali sono inclusi nel repository; la rigenerazione normale non
richiede rete. Il manifest degli asset registra revisione e SHA-256 del font e
del kit sorgente. Il test browser usa Edge, o `PLAYWRIGHT_CHANNEL` se configurato.

## Inventario verificato

- 24 icone UI, con nomi originali: Esplora, Cerca, Mappa, Viaggi, Itinerario,
  Date, Budget, Lista, Biglietti, Documenti, Meteo, Note, Foto, Amici, Condividi,
  Offline, Preferiti, Notifiche, Impostazioni, Profilo, Aggiungi, Filtri,
  Posizione e Orario.
- 14 categorie: Partenza, Destinazione, Zampata, Alloggio, Ristorante, Caffe',
  Attrazione, Museo, Treno, Volo, Auto, Natura, Spiaggia e Shopping.
- Due gatti, ciascuno con Tappa, Opzionale, Preferito, Visitato; facce e simboli
  estratti dalle funzioni originali. Gli stati qui sono solo grafici.
- Sei qui, Gruppo, percorso tratteggiato, logo e icone app dal kit.
- Dieci PNG: per ogni gatto app 192 e 512, maskable 512, monocromatica 512,
  favicon 48. Il soggetto maskable e' ridotto nella safe area centrale;
  la silhouette monocromatica comune ai due gatti e' intenzionale.

Il refuso quindici e' conservato negli originali e corretto nell'inventario
generato: nessun quindicesimo pin inventato. L'estrattore esegue solo il kit
locale affidabile: non usare Node VM per contenuti caricati dagli utenti.

## API e stile

Il pacchetto `@purrroute/design-system` espone token, tipi, nomi icone e categorie,
`renderSvg` per markup e `createSvg` per un nodo SVG. Un ID di istanza valido e
univoco rinomina tutti i riferimenti SVG, evitando collisioni tra gradienti e use.
Etichetta opzionale con escape XML; senza etichetta la grafica e' decorativa.
I pulsanti che usano icone decorative devono avere un proprio nome accessibile.
Non passare markup utente a questa API.

Palette originale preservata: sfondo #F5F3EF, inchiostro #14202B, teal #12B5A3,
arancio #FFB067; temi scuri e gatti invariati. Aggiunte semantiche:
testo secondario chiaro #596674 e azione chiara #076A61 per contrasto AA.
Il primo candidato azione #087E73 ha fallito il test e non e' stato mantenuto.
Tema scuro usa testo secondario #A7B4C1. Tipografia Plus Jakarta Sans self-hosted,
pesi variabili originali 200-800; font e OFL redistribuiti insieme.

Le superfici dei nuovi componenti hanno raggio 8 px, letter-spacing 0 e font
non proporzionali alla larghezza viewport. La galleria del kit aveva raggi 20 px
e tracking negativo: non sono stati trasferiti ai controlli applicativi.
SVG originali non alterati per simulare contrasto: nella futura mappa verificare
contrasto non testuale e accompagnare categoria/stato con un nome accessibile.

## Verifiche eseguite

- Sei test Node: inventario e stati originali, riferimenti SVG, escape etichette,
  dimensioni e contenuto PNG, monocromatica, font/OFL, contrasto testo/azioni.
- TypeScript strict senza emissione: passato.
- Rigenerazione asset: passata; verifica hash del kit sorgente.
- Edge headless: 390x844 e 1440x1000, chiaro/scuro; font, assenza overflow,
  immagini caricate, cambio gatto e tema, nessun errore JavaScript.
- Screenshot nei risultati locali ignorati da Git, controllati visivamente.
- Validazione standalone: quattro asserzioni passate. Il parser dello strumento
  non ha estratto il conteggio Node; l'esecuzione diretta riporta 6/6 passati.

Evidenza riproducibile:
[piano](../.tsupgrader/runtime-validation/eval-plan.json).
I risultati sono generati dallo strumento, non una baseline di aggiornamento.
Non e' attestata conformita' WCAG AA dell'app completa, ancora da costruire.

## Checklist manuale

- Aprire preview su PC e smartphone; provare chiaro/scuro e tema sistema.
- Controllare le 24 icone e 14 categorie contro il kit, senza ridisegni.
- Navigare le scelte con tastiera e verificare focus visibile e nomi.
- Cambiare gatto, aprire i PNG e verificare volto, dimensioni e maschere.
- Verificare font anche senza connessione, a file gia' presenti.

Rischi: supporto browser del font/immagini da ampliare nei passi successivi;
pin a basso contrasto richiedono attenzione nella mappa; nessuna certificazione
store o installabilita' PWA e' implicita in questi asset. ADR:
[0012](adr/0012-design-tooling.md). Nessun push o servizio remoto attivato.