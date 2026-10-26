# ADR-0007: Kit autorevole, categorie e lingue

Stato: accettato. Data: 2026-10-26.

## Fatti e decisione

Il kit HTML nella root e' fonte di verita' del design; il Markdown e' descrittivo.
Riutilizzare token, SVG e gatti del kit. Conservare gli originali senza correzioni
in questo passo. Le 14 voci in `PINS` sono le categorie approvate: il testo
quindici e' un refuso confermato dall'utente, non una categoria mancante.

Tema chiaro/scuro, teal #12B5A3, arancio #FFB067 e Plus Jakarta Sans come
direzione visuale. Il font sara' self-hosted solo dopo la verifica della licenza.
Le strisce sono applicate dal codice solo al gatto rosso: non aggiungerle alla
cipria interpretando l'assenza come errore.

Italiano e inglese al primo rilascio. Chiavi semantiche, formattazione con `Intl`,
timezone del viaggio esplicita; i contenuti degli utenti non si traducono da soli.
La libreria i18n sara' scelta e verificata prima dell'adozione.

## Alternative e conseguenze

Una libreria di icone generica non deve sostituire gli SVG originali del kit.
Non duplicare il design dal Markdown e non inventare una quindicesima categoria.
Il modello dati per preferito e visitato resta aperto fino al passo 4: quattro
varianti grafiche non impongono un enum esclusivo.

Al passo 2 verificare contrasto AA, temi, nomi accessibili, inventario completo e
generazione reale di PNG 192/512, maskable, monocromatica e favicon. Documentare
eventuali aggiustamenti di accessibilita' senza sostituire l'identita' del kit.

## Fonti e non verificato

Kit HTML e Markdown letti il 2026-10-26, conferma utente delle 14 categorie.
Il testo dichiara 24 icone UI; conteggio completo non verificato nella lettura
iniziale troncata. Licenza/manutenzione del font e contrasto: non verificato.
La presenza su Google Fonts non implica licenza CC0.