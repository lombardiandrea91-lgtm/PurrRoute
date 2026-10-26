# Fondamenta decisionali

Data: 2026-10-26. Ambito: solo passo 0. La richiesta di avviare
l'implementazione approva la proposta raccolta nella fase di domande.
Le decisioni accettate non attestano fattibilita' economica o conformita' di
servizi non ancora selezionati.

## Vincoli confermati dall'utente

| Tema | Decisione |
| --- | --- |
| Pubblico | App pubblica gratuita; circa 10 utenti attivi iniziali |
| Proprieta' | Codice privato e proprietario; diritti sul kit confermati dall'utente |
| API | 0 EUR/mese; niente upgrade o addebiti automatici |
| Infrastruttura | 0 EUR/mese per hosting, database, file, backup e monitoraggio |
| Regione | Preferenza per hosting gestito UE, da verificare anche per copie e backup |
| Lingue | Italiano e inglese completi al primo rilascio |
| Account | Email/password; viaggi locali consentiti senza account |
| Google | Riguarda l'accesso a GitHub, non il login nell'app |
| Distribuzione | PWA browser/Android; TWA su Google Play in un passo successivo |
| Kit | 14 categorie; la dicitura quindici e' un refuso |
| Git | Commit locale autorizzato per i documenti; nessun push |

Dominio e account Play Console non disponibili. Il budget infrastruttura non
includeva dominio e Play nella domanda iniziale: non e' un'autorizzazione a
sostenerne i costi. Eventuali costi richiederanno una decisione separata.

## Fatti verificati

- Il kit HTML contiene CSS per tema chiaro e scuro, SVG inline e funzioni per
  gatti, pin, logo, icona app e favicon. Il Markdown e' solo descrittivo.
- Il font viene caricato da Google Fonts: Plus Jakarta Sans, pesi 400/600/800.
- L'array `PINS` contiene 14 categorie: Partenza, Destinazione, Zampata,
  Alloggio, Ristorante, Caffe', Attrazione, Museo, Treno, Volo, Auto, Natura,
  Spiaggia e Shopping. Non aggiungere una categoria inventata.
- I quattro stati visivi sono Tappa, Opzionale, Preferito e Visitato; sono presenti
  Sei qui, Gruppo e il percorso tratteggiato. Il dominio del passo 4 separa
  pianificazione obbligatoria/opzionale dai marcatori preferito e visitato (ADR-0014).
- Le anteprime SVG etichettate 192/512 non sono PNG gia' esportati.
- La cartella, all'avvio di questa esecuzione, conteneva solo i kit e non aveva Git.

| Token | Chiaro | Scuro |
| --- | --- | --- |
| Sfondo | #F5F3EF | #0E151C |
| Superficie | #FFFFFF | #17212B |
| Chip | #EEF1F4 | #233140 |
| Testo e icone | #14202B | #EEF3F7 |
| Testo secondario | #6B7683 | #92A1AF |

Accenti nel kit: teal #12B5A3 e arancio #FFB067. Il contrasto AA non e' attestato.

## Ipotesi di lavoro

- Il carico iniziale potrebbe rientrare in piani gratuiti: non e' una garanzia.
- Una SPA e un backend modulare sono sufficienti; non e' richiesto SSR iniziale.
- L'accesso locale ai viaggi permette un fallback utile quando la rete o i
  provider non rispondono. Non implica mappe offline, backup o sync gia' pronti.
- Gli account condivideranno identita' e dati attraverso il backend, non tramite
  copia automatica del database browser o servizi di sincronizzazione esterni.

## Decisioni aperte e non verificato

| Elemento | Stato e momento della verifica |
| --- | --- |
| Hosting gestito UE a costo zero | non verificato; selezione dopo confronto delle condizioni |
| Provider esterni | Prezzi, quote, uso, cache, archiviazione e regione: non verificato; passo 1 |
| Font self-hosted | Verificato al passo 2: OFL 1.1, font originale locale e licenza allegata |
| Icone UI | Verificato al passo 2: 24 icone con estrazione e test automatici |
| Accessibilita' | Test contrasto e axe locale passati; verifica completa con tecnologie assistive: non verificato |
| Versioni dipendenze | Toolchain API diretta verificata in ADR-0015; audit transitive e runtime hosting produzione ancora da completare |
| Preferito e visitato | Risolto al passo 4: pianificazione required/optional separata da preferito e visitedAt, ADR-0014 |
| Conflitti sync | Risolto al passo 7 in ADR-0018: versione server per viaggio, 409 e scelta esplicita cloud/device; nessun merge automatico |
| Email produzione | Provider, dominio mittente, quote e deliverability: non verificato; sink solo locale al passo 4 |
| Google Play | Costi e requisiti correnti: non verificato; passo 13 |
| Repository remoto | Visibilita', accesso e contenuti: non verificato; prima di qualsiasi push |

## Confini e gestione del degrado

Dominio, interfaccia, dati, account, autorizzazione e sincronizzazione sono nostri.
Mappe, ricerca, percorsi, meteo, consigli, AI, file, email e push passano per
interfacce sostituibili. Nessun servizio viene integrato in questo passo.

Ogni adapter dovra' dichiarare timeout, errori, quota, politica di cache conforme
ai termini e fallback. Quote per utente e globali sono applicate sul server;
esaurirle non deve attivare pagamenti. Una cache non e' consentita implicitamente.
Le API key e gli altri segreti non sono inviati al client ne' salvati in Git.
Le chiavi pubbliche di protocollo, per esempio una futura chiave pubblica VAPID,
non sono segreti; non confonderle con credenziali API del provider.

AI, visione e consigli sono disattivabili tramite flag server. Il nucleo manuale
non ne dipende. Screenshot e documenti non sono inviati automaticamente a terzi.
Nessuna promessa di zero retention senza verifica delle condizioni effettive.

## Ordine dei passi

0. Fondamenta decisionali: solo documenti.
1. Ricerca dei servizi esterni: solo ricerca, senza integrazioni.
2. Design system dal kit e asset.
3. Shell e PWA.
4. Backend, dati e account.
5. Nucleo del viaggio local-first.
6. Mappa: obiettivo MVP utilizzabile.
7. Offline e sincronizzazione.
8. Logistica del viaggio.
9. Esplora e consigli.
10. Importazione da link e screenshot.
11. Collaborazione.
12. Notifiche e posizione.
13. Pacchetto Google Play.
14. Rifinitura e rilascio.

I contratti per local-first precedono la sync completa; il passo 7 implementa il
primo flusso manuale owner-only. Autenticazione e permessi server non possono
attendere il passo collaborazione. Ogni passo termina con
verifica e resoconto. Dal 2026-10-26 l'utente autorizza il proseguimento senza OK
intermedi, senza deroghe agli altri vincoli. Il confronto servizi e' documentato
nella [ricerca del passo 1](service-selection.md).