import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import SmartFilter from '../components/SmartFilter';
import { CARD_CATALOG, TYPE_LABELS_IT, RARITIES } from '../game/data/cardCatalog';
import { useAuth } from '../context/AuthContext';
import { getCollectionMap } from '../services/collection';
import { getUserDecks, saveDeck, deleteDeck } from '../services/decks';
import { playMedievalSound } from '../game/data/medievalAudio';

const TYPE_ICONS = {
  knight: '⚔️', weapon: '🗡️', shield: '🛡️', item: '🧪', terrain: '🌍',
};

const RARITY_BORDER = {
  leggendaria: '#c9a84c',
  epica: '#8b5fbf',
  rara: '#2a5da8',
  comune: '#5a5a7a',
};

const MIN_KNIGHTS = 5;
const MAX_DECK = 45;
const MAX_COPIES = 5;
const MAX_SAVED_DECKS = 5;

/* ── Dark Fantasy Quantity Popup with Slider ─────── */
function QuantityPopup({ card, maxQty, onConfirm, onClose }) {
  const [qty, setQty] = useState(1);
  const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];
  const accentColor = card.rarity?.id === 'leggendaria' ? '#c9a84c' : '#a83232';

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="w-80 sm:w-96 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 40%, #12101c 100%)',
          border: `2px solid ${borderColor}88`,
          boxShadow: `0 0 60px ${borderColor}22, 0 25px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: `${borderColor}44`, background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${borderColor}15`, border: `1px solid ${borderColor}33` }}>
              <span className="text-xl">{TYPE_ICONS[card.type]}</span>
            </div>
            <div>
              <p className="text-white font-display font-bold text-sm">{card.name}</p>
              <p className="text-xs mt-0.5" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          <p className="text-center mb-6 text-sm font-display" style={{ color: '#b8a67a' }}>
            Quante copie vuoi schierare?
          </p>

          {/* Large quantity display */}
          <div className="text-center mb-5">
            <span className="text-5xl font-display font-bold" style={{ color: borderColor }}>{qty}</span>
            <span className="text-lg text-fantasy-silver/50 ml-1">/ {maxQty}</span>
          </div>

          {/* Range slider */}
          <div className="px-2 mb-6">
            <input
              type="range"
              min={1}
              max={maxQty}
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="deck-qty-slider w-full"
              style={{
                '--slider-color': borderColor,
                '--slider-accent': accentColor,
              }}
            />
            <div className="flex justify-between mt-2 px-1">
              {Array.from({ length: maxQty }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setQty(i + 1)}
                  className="text-[10px] font-display font-bold transition-colors"
                  style={{ color: i < qty ? borderColor : '#3a3a5a' }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <button
            onClick={() => { onConfirm(qty); }}
            className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition-all hover:brightness-110 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${borderColor}, ${borderColor}bb)`,
              color: '#0a0a0f',
              boxShadow: `0 4px 15px ${borderColor}33, 0 2px 0 ${borderColor}88`,
            }}
          >
            Conferma — Schiera ×{qty}
          </button>
        </div>
      </motion.div>

      {/* Slider CSS injected inline */}
      <style>{`
        .deck-qty-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
          background: linear-gradient(90deg, var(--slider-color) 0%, #1a1a2e 100%);
          outline: none;
          cursor: pointer;
        }
        .deck-qty-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, var(--slider-color), #0a0a0f);
          border: 2px solid var(--slider-color);
          box-shadow: 0 0 12px color-mix(in srgb, var(--slider-color) 40%, transparent),
                      0 2px 6px rgba(0,0,0,0.5);
          cursor: grab;
          transition: box-shadow 0.2s;
        }
        .deck-qty-slider::-webkit-slider-thumb:active { cursor: grabbing; box-shadow: 0 0 20px var(--slider-color); }
        .deck-qty-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, var(--slider-color), #0a0a0f);
          border: 2px solid var(--slider-color);
          box-shadow: 0 0 12px color-mix(in srgb, var(--slider-color) 40%, transparent);
          cursor: grab;
        }
        .deck-qty-slider::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: #1a1a2e;
        }
      `}</style>
    </motion.div>
  );
}

/* ═══════════ Main DeckBuilder ═══════════ */
export default function DeckBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [owned, setOwned] = useState({});
  const [knights, setKnights] = useState([]);
  const [deckCards, setDeckCards] = useState([]);
  const [deckName, setDeckName] = useState('');
  const [deckId, setDeckId] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [knightRarities, setKnightRarities] = useState(new Set());
  const [equipTypes, setEquipTypes] = useState(new Set());
  const [equipRarities, setEquipRarities] = useState(new Set());
  const [qtyPopup, setQtyPopup] = useState(null);
  const [randomError, setRandomError] = useState('');

  useEffect(() => {
    if (!user) return;
    getCollectionMap(user.id).then(setOwned);
    getUserDecks(user.id).then(setSavedDecks);
  }, [user]);

  const getAvailable = useCallback((catalogId) => {
    const totalOwned = owned[catalogId] ?? 0;
    const usedHere = [...knights, ...deckCards].filter(id => id === catalogId).length;
    return Math.max(0, totalOwned - usedHere);
  }, [owned, knights, deckCards]);

  const allKnights = useMemo(() => CARD_CATALOG.filter(c => c.type === 'knight'), []);
  const allEquipment = useMemo(() => CARD_CATALOG.filter(c => c.type !== 'knight'), []);

  const filteredKnights = useMemo(() => {
    return allKnights.filter(c => {
      if (knightRarities.size > 0 && !knightRarities.has(c.rarity?.id)) return false;
      return true;
    });
  }, [allKnights, knightRarities]);

  const filteredEquipment = useMemo(() => {
    return allEquipment.filter(c => {
      if (equipTypes.size > 0 && !equipTypes.has(c.type)) return false;
      if (equipRarities.size > 0 && !equipRarities.has(c.rarity?.id)) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allEquipment, equipTypes, equipRarities, search]);

  const deckTotal = useMemo(() => knights.length + deckCards.length, [knights, deckCards]);
  const deckByType = useMemo(() => {
    const grouped = { weapon: 0, shield: 0, item: 0, terrain: 0 };
    deckCards.forEach(id => {
      const c = CARD_CATALOG.find(x => x.catalogId === id);
      if (c && grouped[c.type] !== undefined) grouped[c.type]++;
    });
    return grouped;
  }, [deckCards]);

  const deckReady = knights.length === MIN_KNIGHTS && deckCards.length === MAX_DECK;

  /* ── Check if random generation is possible ── */
  const canRandomize = useMemo(() => {
    let knightCount = 0;
    for (const k of allKnights) {
      knightCount += Math.min(owned[k.catalogId] ?? 0, MAX_COPIES);
    }
    let equipCount = 0;
    for (const e of allEquipment) {
      equipCount += Math.min(owned[e.catalogId] ?? 0, MAX_COPIES);
    }
    return knightCount >= MIN_KNIGHTS && equipCount >= MAX_DECK;
  }, [allKnights, allEquipment, owned]);

  /* ── Left-click Knight: ADD ONLY ── */
  function handleKnightClick(card) {
    const totalOwned = owned[card.catalogId] ?? 0;
    const available = getAvailable(card.catalogId);
    if (knights.length >= MIN_KNIGHTS || totalOwned <= 0 || available <= 0) return;

    const maxAdd = Math.min(available, MIN_KNIGHTS - knights.length, MAX_COPIES);
    if (maxAdd === 1) {
      playMedievalSound('click');
      setKnights(prev => [...prev, card.catalogId]);
    } else if (maxAdd > 1) {
      setQtyPopup({ card, maxQty: maxAdd, isKnight: true });
    }
  }

  /* ── Left-click Equipment: ADD ONLY ── */
  function handleEquipmentClick(card) {
    const totalOwned = owned[card.catalogId] ?? 0;
    const available = getAvailable(card.catalogId);
    if (deckCards.length >= MAX_DECK || totalOwned <= 0 || available <= 0) return;

    const maxAdd = Math.min(available, MAX_DECK - deckCards.length, MAX_COPIES);
    if (maxAdd === 1) {
      playMedievalSound('click');
      setDeckCards(prev => [...prev, card.catalogId]);
    } else if (maxAdd > 1) {
      setQtyPopup({ card, maxQty: maxAdd, isKnight: false });
    }
  }

  /* ── Right-click: REMOVE 1 copy from deck ── */
  function handleRightClickKnight(e, catalogId) {
    e.preventDefault();
    const idx = knights.indexOf(catalogId);
    if (idx === -1) return;
    playMedievalSound('click');
    setKnights(prev => prev.filter((_, i) => i !== idx));
  }

  function handleRightClickEquipment(e, catalogId) {
    e.preventDefault();
    const idx = deckCards.indexOf(catalogId);
    if (idx === -1) return;
    playMedievalSound('click');
    setDeckCards(prev => prev.filter((_, i) => i !== idx));
  }

  function handleQtyConfirm(qty) {
    const { card, isKnight } = qtyPopup;
    const copies = Array(qty).fill(card.catalogId);
    if (isKnight) {
      setKnights(prev => [...prev, ...copies]);
    } else {
      setDeckCards(prev => [...prev, ...copies]);
    }
    playMedievalSound('click');
    setQtyPopup(null);
  }

  /* ── Smart Random Deck Generator (flattened pool) ── */
  function randomizeDeck() {
    setRandomError('');

    if (!canRandomize) {
      setRandomError('Carte insufficienti! Servono almeno 5 cavalieri e 45 equipaggiamenti.');
      playMedievalSound('error');
      return;
    }

    playMedievalSound('parchment');
    const tempKnights = [];
    const tempDeck = [];
    const tempUsage = {};

    // Build flattened knight pool
    const knightPool = [];
    for (const k of allKnights) {
      const avail = owned[k.catalogId] ?? 0;
      for (let i = 0; i < Math.min(avail, MAX_COPIES); i++) {
        knightPool.push(k.catalogId);
      }
    }
    // Fisher-Yates shuffle
    for (let i = knightPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [knightPool[i], knightPool[j]] = [knightPool[j], knightPool[i]];
    }
    for (const cid of knightPool) {
      if (tempKnights.length >= MIN_KNIGHTS) break;
      const used = tempUsage[cid] ?? 0;
      const avail = (owned[cid] ?? 0) - used;
      if (avail > 0) {
        tempKnights.push(cid);
        tempUsage[cid] = used + 1;
      }
    }

    // Build flattened equipment pool
    const equipPool = [];
    for (const e of allEquipment) {
      const avail = owned[e.catalogId] ?? 0;
      for (let i = 0; i < Math.min(avail, MAX_COPIES); i++) {
        equipPool.push(e.catalogId);
      }
    }
    for (let i = equipPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [equipPool[i], equipPool[j]] = [equipPool[j], equipPool[i]];
    }
    for (const cid of equipPool) {
      if (tempDeck.length >= MAX_DECK) break;
      const used = tempUsage[cid] ?? 0;
      const avail = (owned[cid] ?? 0) - used;
      if (avail > 0) {
        tempDeck.push(cid);
        tempUsage[cid] = used + 1;
      }
    }

    if (tempKnights.length < MIN_KNIGHTS || tempDeck.length < MAX_DECK) {
      setRandomError(`Generazione incompleta: ${tempKnights.length} cavalieri, ${tempDeck.length} carte.`);
      playMedievalSound('error');
      return;
    }

    setKnights(tempKnights);
    setDeckCards(tempDeck);
  }

  async function handleSave() {
    if (!user) return;

    // Limit: max 5 saved decks (allow update of existing)
    if (!deckId && savedDecks.length >= MAX_SAVED_DECKS) {
      playMedievalSound('error');
      setRandomError(`Massimo ${MAX_SAVED_DECKS} mazzi salvati! Elimina un mazzo per salvarne uno nuovo.`);
      return;
    }

    setSaving(true);
    setRandomError('');
    playMedievalSound('parchment');
    try {
      const result = await saveDeck(user.id, {
        id: deckId,
        name: deckName || 'Mazzo Senza Nome',
        knights,
        cards: deckCards,
      });
      if (result) {
        setDeckId(result.id);
        playMedievalSound('save');
        getUserDecks(user.id).then(setSavedDecks);
      }
    } catch (err) {
      console.error('Save deck error:', err);
      playMedievalSound('error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDeck(e, deck) {
    e.stopPropagation();
    if (!user) return;
    playMedievalSound('click');
    const ok = await deleteDeck(user.id, deck.id);
    if (ok) {
      setSavedDecks(prev => prev.filter(d => d.id !== deck.id));
      if (deckId === deck.id) {
        setDeckId(null);
        setDeckName('');
        setKnights([]);
        setDeckCards([]);
      }
    }
  }

  function loadDeck(deck) {
    playMedievalSound('parchment');
    setDeckId(deck.id);
    setDeckName(deck.name);
    setKnights(deck.knights ?? []);
    setDeckCards(deck.cards ?? []);
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display font-bold text-3xl text-white">
              Deck <span className="text-gold-gradient">Builder</span>
            </h1>
            <div className="flex items-center gap-3">
              {randomError && (
                <span className="text-xs text-red-400 max-w-[200px] text-right leading-tight">{randomError}</span>
              )}
              <button
                onClick={randomizeDeck}
                disabled={!canRandomize}
                className="px-4 py-2 rounded-lg border border-fantasy-gold/40 text-fantasy-gold text-xs font-display font-semibold hover:bg-fantasy-gold/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🎲 Genera Mazzo Casuale
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ═══ Left: Card Selection ═══════════════ */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Section 1: Knights ─────────────── */}
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold text-lg text-white">⚔️ Seleziona Cavalieri</h2>
                  <span className={`text-xs font-bold ${knights.length >= MIN_KNIGHTS ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    {knights.length}/{MIN_KNIGHTS}
                  </span>
                  <SmartFilter
                    rarityOptions={RARITIES}
                    selectedTypes={new Set()}
                    selectedRarities={knightRarities}
                    onChange={(_t, r) => setKnightRarities(r)}
                  />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filteredKnights.map(card => {
                    const totalOwned = owned[card.catalogId] ?? 0;
                    const available = getAvailable(card.catalogId);
                    const inDeck = knights.filter(id => id === card.catalogId).length;
                    const canAdd = totalOwned > 0 && available > 0 && knights.length < MIN_KNIGHTS;
                    const disabled = totalOwned <= 0 || (!canAdd && inDeck === 0);
                    const borderColor = inDeck > 0 ? '#c9a84c' : RARITY_BORDER[card.rarity?.id ?? 'comune'];

                    return (
                      <div
                        key={card.catalogId}
                        onClick={() => !disabled && handleKnightClick(card)}
                        onContextMenu={(e) => handleRightClickKnight(e, card.catalogId)}
                        className="relative rounded-xl overflow-hidden text-left transition-all duration-200 select-none"
                        style={{
                          background: disabled ? '#0a0a0f' : '#12121a',
                          border: `2px solid ${disabled ? '#1a1a2a' : borderColor}`,
                          opacity: disabled ? 0.35 : 1,
                          transform: inDeck > 0 ? 'translateY(-3px)' : 'none',
                          boxShadow: inDeck > 0 ? `0 0 15px ${borderColor}55` : 'none',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div className="aspect-[3/4] p-2 flex flex-col items-center justify-between">
                          <span className="text-2xl">⚔️</span>
                          <div className="text-center">
                            <p className="font-display font-semibold text-white text-[10px] leading-tight">{card.name}</p>
                            <p className="text-[8px] mt-0.5" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
                          </div>
                          <div className="text-[9px] text-fantasy-silver">
                            ATK:{card.baseAtk} DEF:{card.baseDef} PA:{card.basePa}
                          </div>
                        </div>
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            background: totalOwned > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,50,50,0.2)',
                            color: totalOwned > 0 ? '#c9a84c' : '#ff4444',
                          }}
                        >
                          x{totalOwned}
                        </div>
                        {inDeck > 0 && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-fantasy-gold text-[9px] text-black font-bold flex items-center justify-center">
                            {inDeck}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Sezione 2: Equipaggiamento Mazzo ─────── */}
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="font-display font-bold text-lg text-white">🛡️ Personalizza Mazzo</h2>
                  <span className={`text-xs font-bold ${deckCards.length >= MAX_DECK ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    {deckCards.length}/{MAX_DECK}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cerca carta…"
                    className="flex-1 px-3 py-2 bg-fantasy-darker border border-fantasy-border rounded-lg text-white text-sm placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
                  />
                  <SmartFilter
                    typeOptions={{ weapon: TYPE_LABELS_IT.weapon, shield: TYPE_LABELS_IT.shield, item: TYPE_LABELS_IT.item, terrain: TYPE_LABELS_IT.terrain }}
                    rarityOptions={RARITIES}
                    selectedTypes={equipTypes}
                    selectedRarities={equipRarities}
                    onChange={(t, r) => { setEquipTypes(t); setEquipRarities(r); }}
                  />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                  {filteredEquipment.map(card => {
                    const totalOwned = owned[card.catalogId] ?? 0;
                    const available = getAvailable(card.catalogId);
                    const inDeck = deckCards.filter(id => id === card.catalogId).length;
                    const canAdd = totalOwned > 0 && available > 0 && deckCards.length < MAX_DECK;
                    const disabled = totalOwned <= 0 || (!canAdd && inDeck === 0);
                    const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];

                    return (
                      <div
                        key={card.catalogId}
                        onClick={() => !disabled && handleEquipmentClick(card)}
                        onContextMenu={(e) => handleRightClickEquipment(e, card.catalogId)}
                        className="relative rounded-xl overflow-hidden text-left transition-all duration-200 select-none"
                        style={{
                          background: disabled ? '#0a0a0f' : '#12121a',
                          border: `2px solid ${disabled ? '#1a1a2a' : borderColor}`,
                          opacity: disabled ? 0.35 : 1,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div className="aspect-[3/4] p-2 flex flex-col items-center justify-between">
                          <span className="text-2xl">{TYPE_ICONS[card.type]}</span>
                          <div className="text-center">
                            <p className="font-display font-semibold text-white text-[10px] leading-tight">{card.name}</p>
                            <p className="text-[8px] mt-0.5" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
                          </div>
                          <div className="text-[8px] text-fantasy-silver">
                            {card.type === 'weapon' && `+${card.atkBonus} ATK · CU ${card.cu}`}
                            {card.type === 'shield' && `+${card.defBonus} DEF · CU ${card.cu}`}
                            {(card.type === 'item' || card.type === 'terrain') && card.desc}
                          </div>
                        </div>
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            background: available > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,50,50,0.2)',
                            color: available > 0 ? '#c9a84c' : '#ff4444',
                          }}
                        >
                          x{totalOwned}
                        </div>
                        {inDeck > 0 && (
                          <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-fantasy-gold text-[9px] text-black font-bold flex items-center justify-center">
                            {inDeck}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═══ Right: Current Deck Summary ═══════ */}
            <div className="space-y-4 sticky top-24 h-fit">
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-lg mb-3">Il tuo Mazzo</h2>

                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Nome del mazzo…"
                  className="w-full px-3 py-2 mb-3 bg-fantasy-darker border border-fantasy-border rounded-lg text-white text-sm placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
                />

                <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                  <span className={`px-2 py-1 bg-fantasy-darker rounded ${knights.length === MIN_KNIGHTS ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    ⚔️ {knights.length}/{MIN_KNIGHTS} cavalieri
                  </span>
                  {Object.entries(deckByType).map(([type, count]) => (
                    <span key={type} className="px-2 py-1 bg-fantasy-darker rounded text-fantasy-silver">
                      {TYPE_ICONS[type]} {count}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-fantasy-silver mb-1">
                  Equipaggiamento: <strong className={deckCards.length >= MAX_DECK ? 'text-fantasy-gold' : 'text-white'}>{deckCards.length}/{MAX_DECK}</strong>
                </div>
                <div className={`text-xs mb-4 font-bold ${deckReady ? 'text-green-400' : 'text-fantasy-silver/60'}`}>
                  Totale: {deckTotal}/50 {deckReady ? '✓ Pronto!' : ''}
                </div>

                <p className="text-[9px] text-fantasy-silver/40 mb-2 italic">Tasto destro su una carta per rimuoverla dal mazzo</p>

                {knights.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-fantasy-gold font-display mb-1">Cavalieri selezionati:</p>
                    <div className="space-y-1">
                      {knights.map((id, i) => {
                        const card = CARD_CATALOG.find(c => c.catalogId === id);
                        return (
                          <div
                            key={`k-${i}`}
                            className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded cursor-pointer hover:bg-fantasy-darker/80 transition"
                            onContextMenu={(e) => handleRightClickKnight(e, id)}
                          >
                            <span className="text-xs">⚔️</span>
                            <span className="flex-1 text-white text-[11px] truncate">{card?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="max-h-[30vh] overflow-y-auto space-y-1 pr-1">
                  {deckCards.length === 0 && (
                    <p className="text-fantasy-silver/40 text-xs text-center py-4">
                      Clicca sulle carte a sinistra per aggiungerle.
                    </p>
                  )}
                  {deckCards.map((id, i) => {
                    const card = CARD_CATALOG.find(c => c.catalogId === id);
                    if (!card) return null;
                    return (
                      <div
                        key={`e-${i}`}
                        className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded cursor-pointer hover:bg-fantasy-darker/80 transition"
                        onContextMenu={(e) => handleRightClickEquipment(e, id)}
                      >
                        <span className="text-xs">{TYPE_ICONS[card.type]}</span>
                        <span className="flex-1 text-white text-[11px] truncate">{card.name}</span>
                        <span className="text-[9px]" style={{ color: card.rarity?.color }}>{card.rarity?.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2">
                  {randomError && (
                    <p className="text-xs text-red-400 text-center py-1">{randomError}</p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={knights.length < MIN_KNIGHTS || deckCards.length === 0 || saving}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #c9a84c, #e4c96a)',
                      color: '#0a0a0f',
                    }}
                  >
                    {saving ? 'Salvataggio…' : `💾 SALVA DECK (${savedDecks.length}/${MAX_SAVED_DECKS})`}
                  </button>
                  <button
                    onClick={() => {
                      if (!deckReady) {
                        playMedievalSound('error');
                        return;
                      }
                      playMedievalSound('armor');
                      navigate('/play', { state: { deckId: deckId, knights, cards: deckCards, mode: 'pve' } });
                    }}
                    disabled={!deckReady}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: deckReady ? 'linear-gradient(135deg, #a83232, #ff4444)' : '#333',
                      color: '#fff',
                      boxShadow: deckReady ? '0 0 25px rgba(168,50,50,0.4)' : 'none',
                    }}
                  >
                    ⚔️ INIZIA PARTITA
                  </button>
                  {(knights.length > 0 || deckCards.length > 0) && (
                    <button
                      onClick={() => { setKnights([]); setDeckCards([]); setDeckId(null); setDeckName(''); setRandomError(''); playMedievalSound('click'); }}
                      className="w-full py-2 rounded-xl border border-fantasy-border text-fantasy-silver text-xs hover:text-fantasy-red hover:border-fantasy-red/40 transition"
                    >
                      Svuota mazzo
                    </button>
                  )}
                </div>
              </div>

              {savedDecks.length > 0 && (
                <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-3">
                    Mazzi Salvati ({savedDecks.length}/{MAX_SAVED_DECKS})
                  </h3>
                  <div className="space-y-2">
                    {savedDecks.map(d => (
                      <div
                        key={d.id}
                        className={`flex items-center gap-2 rounded-lg border transition ${
                          d.id === deckId ? 'border-fantasy-gold bg-fantasy-gold/10' : 'border-fantasy-border hover:border-fantasy-gold/40'
                        }`}
                      >
                        <button
                          onClick={() => loadDeck(d)}
                          className="flex-1 text-left px-3 py-2"
                        >
                          <p className="text-white text-xs font-display">{d.name}</p>
                          <p className="text-fantasy-silver text-[10px]">
                            {(d.knights?.length ?? 0)} cavalieri · {(d.cards?.length ?? 0)} carte
                          </p>
                        </button>
                        <button
                          onClick={(e) => handleDeleteDeck(e, d)}
                          className="px-3 py-2 text-fantasy-silver/40 hover:text-red-400 transition"
                          title="Elimina mazzo"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {qtyPopup && (
          <QuantityPopup
            card={qtyPopup.card}
            maxQty={qtyPopup.maxQty}
            onConfirm={handleQtyConfirm}
            onClose={() => setQtyPopup(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
