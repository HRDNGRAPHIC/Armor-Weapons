# 🏰 Armor & Weapons — Guida Setup Supabase (Ultra-Dettagliata)

Questa guida ti spiega **passo per passo** come configurare le tabelle Supabase necessarie per il funzionamento completo del gioco: collezione carte, mazzi salvati e pacchetti regalo.

---

## 📋 Pre-requisiti

1. Un progetto Supabase attivo su [supabase.com](https://supabase.com)
2. Le variabili `.env` configurate:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
3. La tabella `profiles` già esistente (creata nel setup auth precedente)

---

## 🔧 STEP 1 — Apri l'SQL Editor

1. Vai su **supabase.com** → il tuo progetto
2. Nel menu laterale sinistro, clicca **SQL Editor**
3. Clicca **+ New query**
4. Copia e incolla **tutto** il blocco SQL qui sotto, poi premi **Run**

---

## 🗄️ STEP 2 — Crea le Tabelle

Copia e incolla **tutto questo blocco** nell'SQL Editor e premi **Run**:

```sql
-- ══════════════════════════════════════════════════════════
-- ARMOR & WEAPONS — DATABASE SETUP
-- Esegui questo script INTERO nell'SQL Editor di Supabase.
-- ══════════════════════════════════════════════════════════

-- ── 1. Tabella: user_collection ──────────────────────────
-- Contiene le carte possedute da ogni giocatore.
-- Ogni riga = 1 tipo di carta con la quantità posseduta.
CREATE TABLE IF NOT EXISTS public.user_collection (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_id  text NOT NULL,
  quantity    integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  obtained_at timestamptz NOT NULL DEFAULT now(),

  -- Un utente non può avere righe duplicate per la stessa carta
  UNIQUE (user_id, catalog_id)
);

-- Indice per query rapide "tutte le carte di un utente"
CREATE INDEX IF NOT EXISTS idx_user_collection_user
  ON public.user_collection (user_id);

-- ── 2. Tabella: user_decks ───────────────────────────────
-- Contiene i mazzi salvati (loadout). Knights e cards sono
-- array JSON di catalogId (es. ["K000","K001","K005"]).
CREATE TABLE IF NOT EXISTS public.user_decks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Mazzo Senza Nome',
  knights     jsonb NOT NULL DEFAULT '[]'::jsonb,
  cards       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_decks_user
  ON public.user_decks (user_id);

-- ── 3. Tabella: user_packs ───────────────────────────────
-- Contiene i pacchetti da aprire (regalo, acquisto, ecc.).
-- redeemed = false → pacchetto ancora da aprire.
CREATE TABLE IF NOT EXISTS public.user_packs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type   text NOT NULL DEFAULT 'standard',
  redeemed    boolean NOT NULL DEFAULT false,
  redeemed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_packs_user_pending
  ON public.user_packs (user_id) WHERE redeemed = false;
```

✅ Dopo aver premuto **Run**, dovresti vedere: `Success. No rows returned.`

---

## 🔒 STEP 3 — Abilita Row Level Security (RLS)

**IMPORTANTISSIMO**: senza queste policy, nessun utente può leggere/scrivere le tabelle tramite l'anon key.

Crea una **nuova query** nell'SQL Editor e incolla questo:

```sql
-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Ogni utente vede SOLO i propri dati
-- ══════════════════════════════════════════════════════════

-- ── user_collection ──
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_collection_select"
  ON public.user_collection FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_collection_insert"
  ON public.user_collection FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_collection_update"
  ON public.user_collection FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_collection_delete"
  ON public.user_collection FOR DELETE
  USING (auth.uid() = user_id);

-- ── user_decks ──
ALTER TABLE public.user_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_decks_select"
  ON public.user_decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_decks_insert"
  ON public.user_decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_decks_update"
  ON public.user_decks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_decks_delete"
  ON public.user_decks FOR DELETE
  USING (auth.uid() = user_id);

-- ── user_packs ──
ALTER TABLE public.user_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_packs_select"
  ON public.user_packs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_packs_insert"
  ON public.user_packs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_packs_update"
  ON public.user_packs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_packs_delete"
  ON public.user_packs FOR DELETE
  USING (auth.uid() = user_id);
```

✅ Dopo aver premuto **Run**: `Success. No rows returned.`

---

## 🎁 STEP 4 — Pacchetti Regalo Automatici per Nuovi Utenti

Per dare **2 pacchetti regalo** a ogni nuovo utente che si registra, crea un **Database Function + Trigger**.

Crea una **nuova query** e incolla:

```sql
-- ══════════════════════════════════════════════════════════
-- TRIGGER: Regala 2 pacchetti standard ad ogni nuovo utente
-- ══════════════════════════════════════════════════════════

-- Funzione che inserisce 2 pack
CREATE OR REPLACE FUNCTION public.grant_welcome_packs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_packs (user_id, pack_type) VALUES
    (NEW.id, 'standard'),
    (NEW.id, 'standard');
  RETURN NEW;
END;
$$;

-- Trigger: scatta dopo ogni INSERT su auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_grant_packs ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_packs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_welcome_packs();
```

✅ Ora ogni nuovo utente riceverà automaticamente 2 pacchetti da aprire nella Lobby.

> **Nota**: per gli utenti **già esistenti**, puoi aggiungere manualmente i pack. Vai al passo 5.

---

## 🧪 STEP 5 — Aggiungere Pack Manualmente (per utenti esistenti)

Se hai utenti che si sono registrati **prima** di creare il trigger, puoi dargli i pack manualmente.

1. Vai su **Table Editor** nel menu di Supabase
2. Seleziona la tabella `user_packs`
3. Clicca **Insert row**
4. Compila:
   - `user_id`: copia l'UUID dell'utente da **Authentication → Users**
   - `pack_type`: `standard`
   - `redeemed`: `false`
5. Ripeti per aggiungere più pacchetti

**Oppure via SQL** — sostituisci `IL_TUO_USER_ID` con l'UUID reale:

```sql
INSERT INTO public.user_packs (user_id, pack_type) VALUES
  ('IL_TUO_USER_ID', 'standard'),
  ('IL_TUO_USER_ID', 'standard');
```

---

## ✅ STEP 6 — Verifica che tutto funzioni

### 6.1 — Controlla le tabelle
1. Vai su **Table Editor**
2. Dovresti vedere 3 nuove tabelle:
   - `user_collection` (vuota — si popola aprendo i pacchetti)
   - `user_decks` (vuota — si popola salvando mazzi nel DeckBuilder)
   - `user_packs` (dovrebbe avere 2 righe per ogni utente con `redeemed = false`)

### 6.2 — Controlla le RLS Policy
1. Vai su **Authentication → Policies**
2. Per ogni tabella dovresti vedere 4 policy (SELECT, INSERT, UPDATE, DELETE)

### 6.3 — Testa nel gioco
1. Accedi con un account
2. Vai nella **Lobby** → dovresti vedere "2 Pacchetti Regalo"
3. Apri un pacchetto → le carte vengono salvate in `user_collection`
4. Vai nel **Deck Builder** → le carte appena ottenute sono visibili
5. Salva un mazzo → viene salvato in `user_decks`
6. Vai nella **Collezione** → vedi tutte le carte con le quantità

---

## 📊 Schema Riassuntivo

```
auth.users (Supabase built-in)
  ├── id (uuid, PK)
  │
  ├──→ user_collection
  │     ├── user_id → auth.users(id) ON DELETE CASCADE
  │     ├── catalog_id (text) — riferimento a CARD_CATALOG
  │     └── quantity (int)
  │
  ├──→ user_decks
  │     ├── user_id → auth.users(id) ON DELETE CASCADE
  │     ├── name (text)
  │     ├── knights (jsonb) — array di catalogId
  │     └── cards (jsonb) — array di catalogId
  │
  └──→ user_packs
        ├── user_id → auth.users(id) ON DELETE CASCADE
        ├── pack_type (text)
        ├── redeemed (boolean)
        └── redeemed_at (timestamptz)
```

- **ON DELETE CASCADE**: se cancelli un utente, tutti i suoi dati vengono eliminati automaticamente.
- **RLS**: ogni utente può vedere/modificare SOLO i propri dati.
- **UNIQUE(user_id, catalog_id)** su `user_collection`: permette l'upsert (merge quantità).

---

## ⚔️ STEP 7 — Colonne ELO, Gold e Starter Chest su `profiles`

Il sistema ELO, l'economia gold e il forziere starter richiedono nuove colonne sulla tabella `profiles`.

Crea una **nuova query** nell'SQL Editor e incolla:

```sql
-- ══════════════════════════════════════════════════════════
-- NUOVE COLONNE PER: Sistema ELO, Gold, Starter Chest
-- Esegui DOPO aver già creato la tabella profiles
-- ══════════════════════════════════════════════════════════

-- ELO ranking (parte da 100)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS elo integer NOT NULL DEFAULT 100;

-- Monete d'oro (parte da 0, +5 per vittoria)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gold integer NOT NULL DEFAULT 0;

-- Vittorie e sconfitte
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;

-- Forziere starter già riscattato?
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS starter_claimed boolean NOT NULL DEFAULT false;
```

✅ Dopo aver premuto **Run**: `Success. No rows returned.`

### 7.1 — Policy RLS per classifica pubblica

La classifica deve poter leggere i profili di **tutti** i giocatori (non solo il proprio).
Se non hai già una policy SELECT pubblica su `profiles`, aggiungi questa:

```sql
-- Permetti a tutti gli utenti autenticati di LEGGERE i profili
-- (necessario per la classifica globale)
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
```

> **Nota**: le policy INSERT/UPDATE su profiles dovrebbero già esistere dal setup auth precedente e limitare la scrittura al solo proprietario.

### 7.2 — Verifica nel gioco

1. Gioca una partita e vinci → il tuo ELO sale (max +10) e guadagni 5 gold
2. Perdi o abbandoni → il tuo ELO scende (max -10), 0 gold
3. Vai nella **Classifica** → vedi i top 50 giocatori per ELO
4. Primo accesso alla **Lobby** → si apre il Forziere Starter con 45 carte
5. Le carte del forziere appaiono nella **Collezione**

---

## ⚠️ Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| "relation user_collection does not exist" | Non hai eseguito lo STEP 2. Esegui lo script SQL delle tabelle. |
| "new row violates row-level security" | Non hai eseguito lo STEP 3. Esegui lo script RLS. |
| Le carte non appaiono dopo l'apertura pack | Controlla che `user_collection` abbia righe. Se vuota, il pack non è stato salvato. |
| Il Deck Builder mostra tutte le carte come "x0" | L'utente non ha ancora aperto pacchetti. Apri un pack nella Lobby prima. |
| Il badge nella Navbar non appare | Controlla `user_packs` — l'utente ha righe con `redeemed = false`? |
| "permission denied for table user_packs" | La funzione del trigger deve avere `SECURITY DEFINER`. Riesegui STEP 4. |

---

## ⚔️ STEP 8 — Colonna `is_new` su `user_collection` + Gestione Quantità Duplicati

### 8.1 — Aggiungere la colonna `is_new`

Il sistema "Badge Nuovo" marca le carte appena ottenute con un pallino rosso pulsante.
Al primo zoom/ispezione nella Collezione, il badge scompare e non riappare più.

```sql
-- ══════════════════════════════════════════════════════════
-- COLONNA is_new: segna le carte come "nuove" finché
-- l'utente non le ispeziona nella Collezione.
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.user_collection
  ADD COLUMN IF NOT EXISTS is_new boolean NOT NULL DEFAULT true;

-- Le carte già esistenti nel DB sono state già viste → false
UPDATE public.user_collection SET is_new = false WHERE is_new = true;
```

### 8.2 — Gestione quantità e duplicati

La colonna `quantity` su `user_collection` gestisce automaticamente i duplicati:
- Ogni carta unica ha una riga con `quantity` >= 1
- Aprendo un pacchetto con una carta già posseduta, il sistema fa **upsert** incrementando `quantity`
- Nel Deck Builder, il giocatore può schierare fino a **5 copie** della stessa carta se le possiede
- Il generatore casuale ("Genera Mazzo Casuale") pesca dalla collezione reale rispettando i duplicati

> **Nota**: Non serve modificare lo schema per i duplicati — la colonna `quantity` è già presente dalla creazione iniziale della tabella `user_collection`. Il Deck Builder salva array JSON con catalogId ripetuti (es. `["K000","K000","K001","K002","K003"]` per 2 copie di K000).

### 8.3 — Verifica

1. Apri un pacchetto → le carte nuove nella **Collezione** mostrano un pallino rosso pulsante
2. Clicca su una carta nuova per ispezionarla → chiudi lo zoom → il pallino scompare
3. Nel **Deck Builder**, se possiedi 3 copie di una carta, puoi aggiungerne fino a 3 nel mazzo
4. Il tasto "INIZIA PARTITA" si attiva solo con **5 cavalieri + 45 carte equipaggiamento**

---

## 🔄 STEP 9 — Realtime Subscription + Limite Mazzi Salvati + Abilitazione Replica

### 9.1 — Abilita Realtime sulla tabella `profiles`

Per aggiornare il gold (e altri campi) in tempo reale nel frontend senza ricaricare la pagina,
è necessario abilitare la **Replica** sulla tabella `profiles`.

```sql
-- ══════════════════════════════════════════════════════════
-- ABILITA REALTIME SU PROFILES
-- Necessario per il listener supabase.channel() nel frontend.
-- ══════════════════════════════════════════════════════════

-- Aggiungi la tabella profiles alla pubblicazione realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
```

> **In alternativa** puoi farlo dalla UI:
> 1. Vai su **Database → Replication**
> 2. Sotto "Tables", attiva il toggle per `profiles`

### 9.2 — Limite massimo mazzi salvati (5 per utente)

Il frontend ora limita a 5 il numero di mazzi salvabili. Per sicurezza lato server,
puoi aggiungere un check constraint o una funzione RPC:

```sql
-- ══════════════════════════════════════════════════════════
-- FUNZIONE RPC: Verifica limite mazzi prima dell'insert
-- Impedisce di superare 5 mazzi anche manipolando le API.
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_deck_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deck_count integer;
BEGIN
  SELECT COUNT(*) INTO deck_count
  FROM public.user_decks
  WHERE user_id = NEW.user_id;

  IF deck_count >= 5 THEN
    RAISE EXCEPTION 'Massimo 5 mazzi per utente raggiunto.';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: scatta solo sugli INSERT (non sugli UPDATE)
DROP TRIGGER IF EXISTS check_user_deck_limit ON public.user_decks;
CREATE TRIGGER check_user_deck_limit
  BEFORE INSERT ON public.user_decks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deck_limit();
```

### 9.3 — Verifica

1. Modifica il `gold` di un utente direttamente nel **Table Editor** di Supabase
2. Nel frontend (Shop o Navbar), il valore gold si aggiorna **istantaneamente** senza refresh
3. Prova a salvare più di 5 mazzi → il frontend blocca il salvataggio con un messaggio di errore
4. Nel Deck Builder, il tasto destro su una carta nel mazzo rimuove 1 copia
5. Il tasto sinistro su una carta con 1 copia disponibile la aggiunge immediatamente (no pop-up)
6. Il tasto sinistro su una carta con più copie apre lo slider di selezione quantità
7. Il tasto "Genera Mazzo Casuale" è disabilitato se le carte possedute sono insufficienti
8. L'icona cestino 🗑️ accanto ai mazzi salvati elimina il mazzo dal database

---

## 📋 STEP 10 — Blueprint Decks + Unificazione Catalogo + Bridge Partita

### 10.1 — Mazzi-Blueprint (Nessun Sequestro Carte)

I mazzi salvati nella tabella `user_decks` ora funzionano come **blueprint** (ricette).
Le carte NON vengono "bloccate" dal salvataggio — la stessa carta può comparire in più mazzi salvati.
La formula di disponibilità nel Deck Builder è:

```
Disponibili = Possedute - In_Uso_nel_Draft_Attuale
```

Dove `In_Uso_nel_Draft_Attuale` = quante copie sono nel mazzo che l'utente sta costruendo **in quel momento**.
I mazzi salvati in precedenza non riducono la disponibilità.

> **Nessuna modifica SQL necessaria.** La logica di sequestro era solo nel frontend.

### 10.2 — Catalogo Unificato con gameData.js

Il file `cardCatalog.js` ora importa direttamente tutti gli array di `gameData.js`:
- `knightNames`, `weaponNames`, `shieldNames` → nomi base
- `itemDefs` → id, cu, desc per ogni oggetto
- `terrainDefs` → id, desc per ogni terreno

Le descrizioni e i costi di utilizzo (CU) delle carte Oggetto/Terreno nel catalogo
vengono LETTI da `gameData.js` (sorgente unica di verità). Se modifichi un `itemDef` in
`gameData.js`, il catalogo si aggiorna automaticamente.

### 10.3 — Categorie Italiane

Le etichette di tipo sono localizzate in italiano ed esportate da `cardCatalog.js`:

```javascript
import { TYPE_LABELS_IT } from './game/data/cardCatalog';
// { knight: 'Cavalieri', weapon: 'Armi', shield: 'Scudi', item: 'Oggetti', terrain: 'Terreni' }
```

### 10.4 — Starter Chest: 50 Carte (Mazzo Legale)

Il `generateStarterDeck()` in `cardLibrary.js` ora produce esattamente **50 carte**:
- 5 Cavalieri (i 4 comuni + 1 duplicato)
- 15 Armi (copie comuni distribuite)
- 15 Scudi (copie comuni distribuite)
- 10 Oggetti (1 di ogni oggetto base con `itemId` unico da `gameData`)
- 5 Terreni (1 di ogni terreno base con `terrainId` unico da `gameData`)

Questo garantisce che ogni nuovo giocatore possa immediatamente costruire un mazzo legale.

### 10.5 — Bridge Deck Builder → Partita

Il bottone **"INIZIA PARTITA"** nel Deck Builder usa il mazzo **attualmente caricato nell'editor**
(non il primo mazzo salvato valido). Passa `{ knights, cards }` via `location.state` a `/play`.

In `GameBoard.jsx`, `buildPlayerDeck()` converte ogni `catalogId` in un oggetto di gioco:
- Tipo `weapon` → `arma`, `shield` → `scudo`, `item` → `oggetto`, `terrain` → `terreno`
- Tutta l'arte viene forzata attraverso `getPixelSVG()` per rendering 8-bit pixelato
- L'AI riceve sempre un mazzo generato casualmente

### 10.6 — Verifica

1. Salva 2 mazzi con carte in comune → entrambi si salvano senza errori
2. Apri il Deck Builder e verifica che la disponibilità = possedute - solo draft attuale
3. Il Forziere Starter regala esattamente 50 carte (5 cavalieri + 45 equipaggiamento)
4. Costruisci un mazzo completo (50 carte) e clicca "INIZIA PARTITA"
5. Verifica che la partita usa esattamente le carte scelte (nomi corretti nel GameBoard)
6. Catene, Riflesso, ecc. funzionano correttamente perché gli `itemId`/`terrainId` matchano `gameData`

---

## 🗑️ STEP 11 — Eliminazione Account (Delete Account RPC)

Il Profilo ora ha un bottone "Elimina Account" che chiama una funzione RPC sicura per cancellare
l'utente da `auth.users`. Grazie ai constraint `ON DELETE CASCADE` sulle tabelle collegate,
tutti i dati dell'utente (carte, mazzi, pacchetti, profilo) vengono eliminati automaticamente.

### 11.1 — Crea la funzione RPC

Apri una **nuova query** nell'SQL Editor e incolla:

```sql
-- ══════════════════════════════════════════════════════════
-- FUNZIONE RPC: Elimina il proprio account da auth.users
-- Il CASCADE si occupa di eliminare profiles, user_collection,
-- user_decks, user_packs automaticamente.
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth.users WHERE id = auth.uid();
$$;
```

### 11.2 — Verifica CASCADE su `profiles`

Se la tabella `profiles` non ha già un foreign key con CASCADE verso `auth.users`, aggiungilo:

```sql
-- Controlla se profiles.id ha un FK ON DELETE CASCADE:
-- Se non ce l'ha, puoi aggiungere:
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
```

> **Nota**: Le tabelle `user_collection`, `user_decks` e `user_packs` hanno già
> `ON DELETE CASCADE` dalla creazione iniziale (STEP 2).

### 11.3 — Verifica

1. Vai nel **Profilo** e clicca "Elimina Account"
2. Appare un popup di conferma con stile Dark Fantasy
3. Clicca "Elimina per sempre" → l'account viene cancellato
4. L'utente viene reindirizzato alla pagina di login
5. Tutti i dati (carte, mazzi, pacchetti) sono stati eliminati dal database

---

## ⚔️ STEP 12 — ELO PvE Statico + Modalità Gioco

### 12.1 — Differenziazione ELO per Modalità

Il sistema ELO ora distingue tra modalità PvE e PvP:

- **PvE (Gioca contro il Computer)**: ELO statico +3 per vittoria, -5 per sconfitta/abbandono
- **PvP (Gioca contro Giocatori)**: Formula Chess.com con K-factor 20 (non ancora attivo)

La modalità viene passata al GameBoard tramite `location.state.mode` e registrata
in `recordGameResult(userId, outcome, mode)`.

### 12.2 — Verifica

1. Dalla Lobby, clicca "Gioca contro il Computer"
2. Vinci → ELO sale di +3
3. Perdi → ELO scende di -5
4. Il bottone "Gioca contro Giocatori" è disabilitato (coming soon)
5. Il valore iniziale dell'ELO è 100 (non 1000)
