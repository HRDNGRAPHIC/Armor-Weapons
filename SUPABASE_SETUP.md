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
