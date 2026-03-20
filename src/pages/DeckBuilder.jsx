import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import { CARD_CATALOG } from '../game/data/cardCatalog';
import { useAuth } from '../context/AuthContext';
import { getCollectionMap } from '../services/collection';
import { getUserDecks, saveDeck, getCardsInUse } from '../services/decks';
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

/* ── Quantity Selector Popup ─────────────────────── */
function QuantityPopup({ card, maxQty, onConfirm, onClose }) {
  const [qty, setQty] = useState(1);
  const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];

  function handleChange(newVal) {
    const clamped = Math.max(1, Math.min(maxQty, newVal));
    if (clamped !== qty) {
      playMedievalSound('click');
      setQty(clamped);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="w-72 sm:w-80 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #12121a 0%, #1a1a2e 50%, #0a0a0f 100%)',
          border: `3px solid ${borderColor}`,
          boxShadow: `0 0 40px ${borderColor}33, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b" style={{ borderColor, background: 'rgba(0,0,0,0.4)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{TYPE_ICONS[card.type]}</span>
            <div>
              <p className="text-white font-bold" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', lineHeight: '1.4' }}>
                {card.name}
              </p>
              <p className="text-[8px] mt-1" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-5">
          <p className="text-center mb-5" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px', color: '#e2d1a3', lineHeight: '1.6' }}>
            Quante copie vuoi schierare?
          </p>

          {/* Slider control */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <button
              onClick={() => handleChange(qty - 1)}
              disabled={qty <= 1}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition disabled:opacity-30"
              style={{
                background: '#0a0a0f',
                border: '2px solid #5a5a7a',
                borderTopColor: '#8a8a9a',
                borderLeftColor: '#8a8a9a',
                borderRightColor: '#2a2a3a',
                borderBottomColor: '#2a2a3a',
                color: '#e2d1a3',
                fontFamily: "'Press Start 2P', monospace",
              }}
            >
              −
            </button>

            {/* Quantity display blocks */}
            <div className="flex gap-1">
              {Array.from({ length: maxQty }, (_, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded flex items-center justify-center transition-all duration-150"
                  style={{
                    background: i < qty
                      ? `linear-gradient(135deg, ${borderColor}, ${borderColor}cc)`
                      : '#1a1a2a',
                    border: `2px solid ${i < qty ? borderColor : '#2a2a3a'}`,
                    boxShadow: i < qty ? `0 0 8px ${borderColor}44` : 'none',
                  }}
                >
                  <span style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '8px',
                    color: i < qty ? '#0a0a0f' : '#3a3a4a',
                    fontWeight: 'bold',
                  }}>
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => handleChange(qty + 1)}
              disabled={qty >= maxQty}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-bold transition disabled:opacity-30"
              style={{
                background: '#0a0a0f',
                border: '2px solid #5a5a7a',
                borderTopColor: '#8a8a9a',
                borderLeftColor: '#8a8a9a',
                borderRightColor: '#2a2a3a',
                borderBottomColor: '#2a2a3a',
                color: '#e2d1a3',
                fontFamily: "'Press Start 2P', monospace",
              }}
            >
              +
            </button>
          </div>

          {/* Confirm */}
          <button
            onClick={() => { playMedievalSound('armor'); onConfirm(qty); }}
            className="w-full py-2.5 rounded-xl font-bold tracking-wider transition hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${borderColor}, ${borderColor}cc)`,
              color: '#0a0a0f',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '9px',
              border: '2px solid transparent',
              borderTopColor: `${borderColor}`,
              borderLeftColor: `${borderColor}`,
              borderRightColor: `${borderColor}88`,
              borderBottomColor: `${borderColor}88`,
              boxShadow: `0 4px 0 #000, 0 0 15px ${borderColor}33`,
            }}
          >
            ✦ SCHIERA ×{qty}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════ Main DeckBuilder ═══════════ */
export default function DeckBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [owned, setOwned] = useState({});
  const [inUse, setInUse] = useState({});
  const [knights, setKnights] = useState([]);
  const [deckCards, setDeckCards] = useState([]);
  const [deckName, setDeckName] = useState('');
  const [deckId, setDeckId] = useState(null);
  const [savedDecks, setSavedDecks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('Tutti');
  const [search, setSearch] = useState('');
  const [qtyPopup, setQtyPopup] = useState(null);

  useEffect(() => {
    if (!user) return;
    getCollectionMap(user.id).then(setOwned);
    getUserDecks(user.id).then(setSavedDecks);
    getCardsInUse(user.id).then(setInUse);
  }, [user]);

  const getAvailable = useCallback((catalogId) => {
    const totalOwned = owned[catalogId] ?? 0;
    const usedElsewhere = inUse[catalogId] ?? 0;
    const usedHere = [...knights, ...deckCards].filter(id => id === catalogId).length;
    return Math.max(0, totalOwned - usedElsewhere - usedHere);
  }, [owned, inUse, knights, deckCards]);

  const allKnights = useMemo(() => CARD_CATALOG.filter(c => c.type === 'knight'), []);
  const allEquipment = useMemo(() => CARD_CATALOG.filter(c => c.type !== 'knight'), []);

  const filteredEquipment = useMemo(() => {
    return allEquipment.filter(c => {
      if (filter !== 'Tutti' && c.type !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allEquipment, filter, search]);

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

  /* ── Knight click: toggle or add with popup ── */
  function handleKnightClick(card) {
    const inDeck = knights.filter(id => id === card.catalogId).length;
    const totalOwned = owned[card.catalogId] ?? 0;
    const available = getAvailable(card.catalogId);

    if (inDeck > 0) {
      playMedievalSound('click');
      const idx = knights.indexOf(card.catalogId);
      setKnights(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    if (knights.length >= MIN_KNIGHTS || totalOwned <= 0 || available <= 0) return;

    const maxAdd = Math.min(available, MIN_KNIGHTS - knights.length, MAX_COPIES);

    if (maxAdd <= 1) {
      playMedievalSound('click');
      setKnights(prev => [...prev, card.catalogId]);
    } else {
      setQtyPopup({ card, maxQty: maxAdd, isKnight: true });
    }
  }

  /* ── Equipment click: toggle or add with popup ── */
  function handleEquipmentClick(card) {
    const inDeck = deckCards.filter(id => id === card.catalogId).length;
    const totalOwned = owned[card.catalogId] ?? 0;
    const available = getAvailable(card.catalogId);

    if (inDeck > 0) {
      playMedievalSound('click');
      const idx = deckCards.indexOf(card.catalogId);
      setDeckCards(prev => prev.filter((_, i) => i !== idx));
      return;
    }

    if (deckCards.length >= MAX_DECK || totalOwned <= 0 || available <= 0) return;

    const maxAdd = Math.min(available, MAX_DECK - deckCards.length, MAX_COPIES);

    if (maxAdd <= 1) {
      playMedievalSound('click');
      setDeckCards(prev => [...prev, card.catalogId]);
    } else {
      setQtyPopup({ card, maxQty: maxAdd, isKnight: false });
    }
  }

  function handleQtyConfirm(qty) {
    const { card, isKnight } = qtyPopup;
    const copies = Array(qty).fill(card.catalogId);
    if (isKnight) {
      setKnights(prev => [...prev, ...copies]);
    } else {
      setDeckCards(prev => [...prev, ...copies]);
    }
    setQtyPopup(null);
  }

  function removeKnight(index) {
    playMedievalSound('click');
    setKnights(prev => prev.filter((_, i) => i !== index));
  }

  function removeEquipment(index) {
    playMedievalSound('click');
    setDeckCards(prev => prev.filter((_, i) => i !== index));
  }

  /* ── Smart Random Deck Generator ── */
  function randomizeDeck() {
    playMedievalSound('parchment');
    const tempKnights = [];
    const tempDeck = [];
    const tempUsage = {};

    const knightPool = [];
    for (const k of allKnights) {
      const avail = (owned[k.catalogId] ?? 0) - (inUse[k.catalogId] ?? 0);
      for (let i = 0; i < Math.min(avail, MAX_COPIES); i++) {
        knightPool.push(k.catalogId);
      }
    }
    for (let i = knightPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [knightPool[i], knightPool[j]] = [knightPool[j], knightPool[i]];
    }
    for (const cid of knightPool) {
      if (tempKnights.length >= MIN_KNIGHTS) break;
      const used = tempUsage[cid] ?? 0;
      const avail = (owned[cid] ?? 0) - (inUse[cid] ?? 0) - used;
      if (avail > 0) {
        tempKnights.push(cid);
        tempUsage[cid] = used + 1;
      }
    }

    const equipPool = [];
    for (const e of allEquipment) {
      const avail = (owned[e.catalogId] ?? 0) - (inUse[e.catalogId] ?? 0);
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
      const avail = (owned[cid] ?? 0) - (inUse[cid] ?? 0) - used;
      if (avail > 0) {
        tempDeck.push(cid);
        tempUsage[cid] = used + 1;
      }
    }

    setKnights(tempKnights);
    setDeckCards(tempDeck);
    playMedievalSound('armor');
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
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
        getCardsInUse(user.id).then(setInUse);
      }
    } catch (err) {
      console.error('Save deck error:', err);
      playMedievalSound('error');
    } finally {
      setSaving(false);
    }
  }

  function loadDeck(deck) {
    playMedievalSound('parchment');
    setDeckId(deck.id);
    setDeckName(deck.name);
    setKnights(deck.knights ?? []);
    setDeckCards(deck.cards ?? []);
  }

  const hasValidDeck = savedDecks.some(d => (d.knights?.length ?? 0) === MIN_KNIGHTS && (d.cards?.length ?? 0) === MAX_DECK);

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display font-bold text-3xl text-white">
              Deck <span className="text-gold-gradient">Builder</span>
            </h1>
            <button
              onClick={randomizeDeck}
              className="px-4 py-2 rounded-lg border border-fantasy-gold/40 text-fantasy-gold text-xs font-display font-semibold hover:bg-fantasy-gold/10 transition"
            >
              🎲 Genera Mazzo Casuale
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ═══ Left: Card Selection ═══════════════ */}
            <div className="lg:col-span-2 space-y-6">
              {/* ── Section 1: Knights ─────────────── */}
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="font-display font-bold text-lg text-white">⚔️ Seleziona Cavalieri</h2>
                  <span className={`text-xs font-bold ${knights.length >= MIN_KNIGHTS ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    {knights.length}/{MIN_KNIGHTS}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {allKnights.map(card => {
                    const totalOwned = owned[card.catalogId] ?? 0;
                    const available = getAvailable(card.catalogId);
                    const inDeck = knights.filter(id => id === card.catalogId).length;
                    const canAdd = totalOwned > 0 && available > 0 && knights.length < MIN_KNIGHTS;
                    const disabled = totalOwned <= 0 || (!canAdd && inDeck === 0);
                    const borderColor = inDeck > 0 ? '#c9a84c' : RARITY_BORDER[card.rarity?.id ?? 'comune'];

                    return (
                      <button
                        key={card.catalogId}
                        onClick={() => handleKnightClick(card)}
                        disabled={disabled}
                        className="relative rounded-xl overflow-hidden text-left transition-all duration-200"
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
                      </button>
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
                  <div className="flex flex-wrap gap-1.5">
                    {['Tutti', 'weapon', 'shield', 'item', 'terrain'].map(t => {
                      const labels = { Tutti: 'Tutti', weapon: 'Armi', shield: 'Scudi', item: 'Oggetti', terrain: 'Terreni' };
                      return (
                        <button
                          key={t}
                          onClick={() => setFilter(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                            filter === t
                              ? 'border-fantasy-gold bg-fantasy-gold/10 text-fantasy-gold'
                              : 'border-fantasy-border text-fantasy-silver hover:text-white hover:border-fantasy-gold/40'
                          }`}
                        >
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>
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
                      <button
                        key={card.catalogId}
                        onClick={() => handleEquipmentClick(card)}
                        disabled={disabled}
                        className="relative rounded-xl overflow-hidden text-left transition-all duration-200"
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
                            {card.type === 'weapon' && `+${card.atkBonus} ATK`}
                            {card.type === 'shield' && `+${card.defBonus} DEF`}
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
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ═══ Right: Current Deck Summary ═══════ */}
            <div className="space-y-4">
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

                {knights.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-fantasy-gold font-display mb-1">Cavalieri selezionati:</p>
                    <div className="space-y-1">
                      {knights.map((id, i) => {
                        const card = CARD_CATALOG.find(c => c.catalogId === id);
                        return (
                          <div key={`k-${i}`} className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded group">
                            <span className="text-xs">⚔️</span>
                            <span className="flex-1 text-white text-[11px] truncate">{card?.name}</span>
                            <button onClick={() => removeKnight(i)} className="text-fantasy-red/50 hover:text-fantasy-red text-[10px] opacity-0 group-hover:opacity-100 transition">✕</button>
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
                      <div key={`e-${i}`} className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded group">
                        <span className="text-xs">{TYPE_ICONS[card.type]}</span>
                        <span className="flex-1 text-white text-[11px] truncate">{card.name}</span>
                        <span className="text-[9px]" style={{ color: card.rarity?.color }}>{card.rarity?.label}</span>
                        <button onClick={() => removeEquipment(i)} className="text-fantasy-red/50 hover:text-fantasy-red text-[10px] opacity-0 group-hover:opacity-100 transition">✕</button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={knights.length < MIN_KNIGHTS || deckCards.length === 0 || saving}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #c9a84c, #e4c96a)',
                      color: '#0a0a0f',
                    }}
                  >
                    {saving ? 'Salvataggio…' : '💾 SALVA DECK'}
                  </button>
                  <button
                    onClick={() => {
                      const deck = savedDecks.find(d => (d.knights?.length ?? 0) === MIN_KNIGHTS && (d.cards?.length ?? 0) === MAX_DECK);
                      if (!deck) {
                        playMedievalSound('error');
                        return;
                      }
                      playMedievalSound('armor');
                      navigate('/play', { state: { deckId: deck.id, knights: deck.knights, cards: deck.cards } });
                    }}
                    disabled={!hasValidDeck}
                    className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: hasValidDeck ? 'linear-gradient(135deg, #a83232, #ff4444)' : '#333',
                      color: '#fff',
                      boxShadow: hasValidDeck ? '0 0 25px rgba(168,50,50,0.4)' : 'none',
                    }}
                  >
                    ⚔️ INIZIA PARTITA
                  </button>
                  {(knights.length > 0 || deckCards.length > 0) && (
                    <button
                      onClick={() => { setKnights([]); setDeckCards([]); setDeckId(null); setDeckName(''); playMedievalSound('click'); }}
                      className="w-full py-2 rounded-xl border border-fantasy-border text-fantasy-silver text-xs hover:text-fantasy-red hover:border-fantasy-red/40 transition"
                    >
                      Svuota mazzo
                    </button>
                  )}
                </div>
              </div>

              {savedDecks.length > 0 && (
                <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                  <h3 className="font-display font-semibold text-white text-sm mb-3">Mazzi Salvati</h3>
                  <div className="space-y-2">
                    {savedDecks.map(d => (
                      <button
                        key={d.id}
                        onClick={() => loadDeck(d)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                          d.id === deckId ? 'border-fantasy-gold bg-fantasy-gold/10' : 'border-fantasy-border hover:border-fantasy-gold/40'
                        }`}
                      >
                        <p className="text-white text-xs font-display">{d.name}</p>
                        <p className="text-fantasy-silver text-[10px]">
                          {(d.knights?.length ?? 0)} cavalieri · {(d.cards?.length ?? 0)} carte
                        </p>
                      </button>
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
