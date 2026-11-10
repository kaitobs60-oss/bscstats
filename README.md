# BSCSTATS

Piattaforma fan-made dedicata al competitivo di Brawl Stars. Interfaccia responsive nero/viola, pensata per iPhone e desktop.

## Moduli
- Home competitiva
- Teams, roster, power rankings e head-to-head
- Player profiles, carriera, confronti e performance
- Scrims & results
- Tournaments, Monthly Finals, Brawl Cup, LCQ e World Finals brackets
- Draft Statistics: pick/ban, FP/LP, pick rate, ban rate e win rate
- Meta Tracker: tier, trend, mappe e modalità
- MVP Rankings e Map Analytics
- News Center e Transfer Market
- Fantasy League
- Match Predictions e Community Predictions
- Draft Bot

## Stato delle funzionalità
La UI e la navigazione sono pubblicate su GitHub Pages. Alcuni strumenti frontend permettono già di provare inserimento scrim, salvataggio roster fantasy, pronostici e suggerimenti Draft Bot. Queste prove vengono salvate nel browser del dispositivo tramite localStorage: **non sono ancora condivise tra utenti e non costituiscono un database online**.

Le schermate con dati competitivi devono distinguere sempre i dati verificati dai contenuti dimostrativi. Non mostrare percentuali o risultati inventati come ufficiali.

## Database centrale
È stato aggiunto `database/schema.sql`, schema PostgreSQL/Supabase per:
- teams, players e roster history
- tournaments, maps, matches e match sets
- draft picks e bans
- scrims e trasferimenti
- news
- predictions e fantasy rosters con utenti autenticati

Lo schema è una base tecnica, non un database già attivo. Per renderlo operativo occorre creare un progetto Supabase, applicare lo schema, configurare le chiavi pubbliche e collegare l'autenticazione e le API. Le operazioni amministrative devono usare credenziali server-side e non esporre mai service-role keys nel sito.

## Pubblicazione
Il frontend statico è distribuito tramite GitHub Pages. Le modifiche a `main` avviano il workflow di deploy.

## Lavoro ancora necessario per il rilascio completo
1. Creare e collegare il database Supabase.
2. Importare roster e dati verificati dei tornei con fonti e date.
3. Collegare il collector delle scrim al database centrale.
4. Calcolare statistiche e ranking da match/draft reali.
5. Attivare login, profili utente, pronostici condivisi e fantasy online.
6. Implementare un pannello admin protetto e validare permessi/RLS.
7. Testare tutte le pagine su iPhone e desktop.

## Principio sui dati
Nessuna statistica dimostrativa deve essere confusa con risultati verificati. Le metriche competitive devono essere calcolate da match e draft documentati e tracciabili.
