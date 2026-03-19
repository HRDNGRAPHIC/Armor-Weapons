import { useState, useMemo, useEffect, useCallback } from 'react';
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

export default function DeckBuilder() {
  const { user } = useAuth();
  const [owned, setOwned] = useState({});       // catalogId → quantity owned
  const [inUse, setInUse] = useState({});       // catalogId → quantity used in OTHER decks
  const [knights, setKnights] = useState([]);    // array of catalogIds
  const [deckCards, setDeckCards] = useState([]); // array of catalogIds (equipment)
  const [deckName, setDeckName] = useState('');
  const [deckId, setDeckId] = useState(null);    // editing existing deck
  const [savedDecks, setSavedDecks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('Tutti');
  const [search, setSearch] = useState('');

  // Load collection & saved decks
  useEffect(() => {
    if (!user) return;
    getCollectionMap(user.id).then(setOwned);
    getUserDecks(user.id).then(setSavedDecks);
    getCardsInUse(user.id).then(setInUse);
  }, [user]);

  // Available = Owned - InUse (in other decks)
  // When building current deck, subtract current deck usage too
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

  // Counters
  const deckByType = useMemo(() => {
    const grouped = { weapon: 0, shield: 0, item: 0, terrain: 0 };
    deckCards.forEach(id => {
      const c = CARD_CATALOG.find(x => x.catalogId === id);
      if (c && grouped[c.type] !== undefined) grouped[c.type]++;
    });
    return grouped;
  }, [deckCards]);

  function addKnight(catalogId) {
    if (knights.length >= MIN_KNIGHTS) return;
    if (knights.includes(catalogId)) return;
    if (getAvailable(catalogId) <= 0) return;
    playMedievalSound('click');
    setKnights(prev => [...prev, catalogId]);
  }

  function removeKnight(catalogId) {
    playMedievalSound('click');
    setKnights(prev => prev.filter(id => id !== catalogId));
  }

  function addEquipment(catalogId) {
    if (deckCards.length >= MAX_DECK) return;
    if (getAvailable(catalogId) <= 0) return;
    playMedievalSound('click');
    setDeckCards(prev => [...prev, catalogId]);
  }

  function removeEquipment(index) {
    playMedievalSound('click');
    setDeckCards(prev => prev.filter((_, i) => i !== index));
  }

  // Randomizer
  function randomizeDeck() {
    playMedievalSound('parchment');
    const tempKnights = [];
    const tempDeck = [];
    const tempUsage = {};

    // Pick 5 random owned knights
    const ownedKnights = allKnights.filter(k => (owned[k.catalogId] ?? 0) > 0);
    const shuffledK = [...ownedKnights].sort(() => Math.random() - 0.5);
    for (const k of shuffledK) {
      if (tempKnights.length >= MIN_KNIGHTS) break;
      const avail = (owned[k.catalogId] ?? 0) - (inUse[k.catalogId] ?? 0) - (tempUsage[k.catalogId] ?? 0);
      if (avail > 0) {
        tempKnights.push(k.catalogId);
        tempUsage[k.catalogId] = (tempUsage[k.catalogId] ?? 0) + 1;
      }
    }

    // Fill 45 equipment from owned
    const ownedEquip = allEquipment.filter(e => (owned[e.catalogId] ?? 0) > 0);
    const shuffledE = [...ownedEquip].sort(() => Math.random() - 0.5);
    let tries = 0;
    while (tempDeck.length < MAX_DECK && tries < 500) {
      const card = shuffledE[tries % shuffledE.length];
      if (card) {
        const avail = (owned[card.catalogId] ?? 0) - (inUse[card.catalogId] ?? 0) - (tempUsage[card.catalogId] ?? 0);
        if (avail > 0) {
          tempDeck.push(card.catalogId);
          tempUsage[card.catalogId] = (tempUsage[card.catalogId] ?? 0) + 1;
        }
      }
      tries++;
    }

    setKnights(tempKnights);
    setDeckCards(tempDeck);
    playMedievalSound('armor');
  }

  // Save loadout
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
        // Refresh
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
                  <h2 className="font-display font-bold text-lg text-white">⚔️ Selezione Cavalieri</h2>
                  <span className={`text-xs font-bold ${knights.length >= MIN_KNIGHTS ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    {knights.length}/{MIN_KNIGHTS}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {allKnights.map(card => {
                    const totalOwned = owned[card.catalogId] ?? 0;
                    const available = getAvailable(card.catalogId);
                    const selected = knights.includes(card.catalogId);
                    const disabled = !selected && (knights.length >= MIN_KNIGHTS || available <= 0 || totalOwned <= 0);
                    const borderColor = selected ? '#c9a84c' : RARITY_BORDER[card.rarity?.id ?? 'comune'];

                    return (
                      <button
                        key={card.catalogId}
                        onClick={() => selected ? removeKnight(card.catalogId) : addKnight(card.catalogId)}
                        disabled={disabled}
                        className="relative rounded-xl overflow-hidden text-left transition-all duration-200"
                        style={{
                          background: disabled ? '#0a0a0f' : '#12121a',
                          border: `2px solid ${disabled ? '#1a1a2a' : borderColor}`,
                          opacity: disabled ? 0.35 : 1,
                          transform: selected ? 'translateY(-3px)' : 'none',
                          boxShadow: selected ? `0 0 15px ${borderColor}55` : 'none',
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
                        {/* Quantity badge */}
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{
                            background: totalOwned > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,50,50,0.2)',
                            color: totalOwned > 0 ? '#c9a84c' : '#ff4444',
                          }}
                        >
                          x{totalOwned}
                        </div>
                        {selected && (
                          <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-fantasy-gold flex items-center justify-center text-[8px] text-black font-bold">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Section 2: Equipment Deck ─────── */}
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="font-display font-bold text-lg text-white">🛡️ Composizione Mazzo</h2>
                  <span className={`text-xs font-bold ${deckCards.length >= MAX_DECK ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                    {deckCards.length}/{MAX_DECK}
                  </span>
                </div>

                {/* Filters */}
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

                {/* Equipment grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[45vh] overflow-y-auto pr-1">
                  {filteredEquipment.map(card => {
                    const totalOwned = owned[card.catalogId] ?? 0;
                    const available = getAvailable(card.catalogId);
                    const inDeck = deckCards.filter(id => id === card.catalogId).length;
                    const disabled = available <= 0 || totalOwned <= 0 || deckCards.length >= MAX_DECK;
                    const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];

                    return (
                      <button
                        key={card.catalogId}
                        onClick={() => addEquipment(card.catalogId)}
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
                        {/* Quantity: owned / available */}
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
              {/* Deck info & save */}
              <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-5">
                <h2 className="font-display font-semibold text-white text-lg mb-3">Il tuo Mazzo</h2>

                {/* Deck name */}
                <input
                  type="text"
                  value={deckName}
                  onChange={e => setDeckName(e.target.value)}
                  placeholder="Nome del mazzo…"
                  className="w-full px-3 py-2 mb-3 bg-fantasy-darker border border-fantasy-border rounded-lg text-white text-sm placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
                />

                {/* Summary counts */}
                <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                  <span className="px-2 py-1 bg-fantasy-darker rounded text-fantasy-silver">⚔️ {knights.length} cavalieri</span>
                  {Object.entries(deckByType).map(([type, count]) => (
                    <span key={type} className="px-2 py-1 bg-fantasy-darker rounded text-fantasy-silver">
                      {TYPE_ICONS[type]} {count}
                    </span>
                  ))}
                </div>

                <div className="text-xs text-fantasy-silver mb-4">
                  Equipaggiamento: <strong className={deckCards.length >= MAX_DECK ? 'text-fantasy-gold' : 'text-white'}>{deckCards.length}/{MAX_DECK}</strong>
                </div>

                {/* Knights list */}
                {knights.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-fantasy-gold font-display mb-1">Cavalieri selezionati:</p>
                    <div className="space-y-1">
                      {knights.map(id => {
                        const card = CARD_CATALOG.find(c => c.catalogId === id);
                        return (
                          <div key={id} className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded group">
                            <span className="text-xs">⚔️</span>
                            <span className="flex-1 text-white text-[11px] truncate">{card?.name}</span>
                            <button onClick={() => removeKnight(id)} className="text-fantasy-red/50 hover:text-fantasy-red text-[10px] opacity-0 group-hover:opacity-100 transition">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Equipment list */}
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
                      <div key={`${id}-${i}`} className="flex items-center gap-2 px-2 py-1 bg-fantasy-darker rounded group">
                        <span className="text-xs">{TYPE_ICONS[card.type]}</span>
                        <span className="flex-1 text-white text-[11px] truncate">{card.name}</span>
                        <span className="text-[9px]" style={{ color: card.rarity?.color }}>{card.rarity?.label}</span>
                        <button onClick={() => removeEquipment(i)} className="text-fantasy-red/50 hover:text-fantasy-red text-[10px] opacity-0 group-hover:opacity-100 transition">✕</button>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
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
                    {saving ? 'Salvataggio…' : '💾 Salva Loadout'}
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

              {/* ── Saved Decks ──────────────────────── */}
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
    </div>
  );
}
