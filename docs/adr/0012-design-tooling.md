# ADR-0012: Estrazione kit, font locale e strumenti design

Stato: accettato per il passo 2. Data: 2026-10-26.

## Decisione e alternative

Eseguire il solo kit originale affidabile in un contesto Node VM per estrarre
inventario e SVG senza ridisegni. La VM non e' una sandbox per file utente:
mai applicare questo metodo a upload, link o screenshot. I percorsi SVG derivano
dal kit, non da altri pianificatori viaggi. Output generati riproducibili,
catalogo TypeScript, preview HTML statica e asset PNG.

Preferire Node test runner integrato per i test puri; non aggiungere Vitest
finche' non serve. Sharp converte SVG in PNG; Playwright verifica layout e font.
Non disegnare a mano un encoder PNG o simulare esportazioni con sole etichette.
Nessuna libreria di icone sostituisce quelle originali.

## Licenze e manutenzione verificate

Fonti ufficiali consultate il 2026-10-26.

| Dipendenza | Licenza | Manutenzione osservata e obblighi |
| --- | --- | --- |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | Attivita' recente, gia' valutata in ADR-0002; conservare gli avvisi applicabili |
| [Sharp](https://github.com/lovell/sharp) | Apache-2.0 | Commit recenti, release 0.35.5 indicata; include libvips e dipendenze con licenze proprie da conservare |
| [Playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Commit recenti, release 1.64.1 indicata; browser distribuiti con licenze proprie, solo sviluppo/test |
| [Plus Jakarta Sans](https://github.com/google/fonts/tree/main/ofl/plusjakartasans) | SIL OFL 1.1 | Font distribuito da Google Fonts, upstream Tokotype; font aggiornato meno frequentemente del tooling, nessuno SLA; conservare copyright e OFL |

Versioni installate fissate nel lockfile, non dedotte dalle versioni della pagina
web. Verificare licenze anche nei pacchetti realmente scaricati. Nessun codice
delle dipendenze viene rilasciato come proprieta' nostra.

Font TTF variabile originale non modificato, self-hosted con licenza allegata;
niente conversione che possa alterarne nomi o metadati. Fonte OFL:
<https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt>.
Metadata ufficiali e upstream:
<https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/METADATA.pb>.
Aggiornamenti del font richiedono nuova verifica e checksum.

## Conseguenze

Il testo del kit dice 15 ma l'estrazione testata conferma 14 categorie e 24 UI.
Le varianti grafiche restano separate dalla futura decisione stati/flag del dominio.
I token originali vengono conservati; eventuali token semantici di contrasto
sono aggiunte documentate, non modifiche nascoste all'originale.
Maskable mantiene il soggetto nella safe area centrale, monocromatica usa un
unico colore opaco e trasparenza. Verificare dimensioni e contenuto dei PNG.