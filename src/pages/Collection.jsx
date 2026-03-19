import { useState, useEffect, useMemo } from 'react';
import Navbar from '../components/layout/Navbar';
import { CARD_CATALOG } from '../game/data/cardCatalog';
import { useAuth } from '../context/AuthContext';
import { getCollectionMap } from '../services/collection';
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

const TYPE_LABELS = {
  Tutti: 'Tutti',
  knight: 'Cavalieri',
  weapon: 'Armi',
  shield: 'Scudi',
  item: 'Oggetti',
  terrain: 'Terreni',
};

/* ── Zoom Overlay ── */
function CardZoom({ card, owned, onClose }) {
  const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full mx-4 rounded-2xl overflow-hidden"
        style={{
          background: '#12121a',
          border: `3px solid ${borderColor}`,
          boxShadow: `0 0 40px ${borderColor}44`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Art area */}
        <div className="aspect-[3/4] bg-black flex items-center justify-center p-6">
          <span className="text-7xl">{TYPE_ICONS[card.type]}</span>
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-white text-lg leading-tight">{card.name}</h3>
            <span className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: `${card.rarity?.color}22`, color: card.rarity?.color }}>
              {card.rarity?.label}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-3 text-sm">
            {card.type === 'knight' && (
              <>
                <span className="text-red-400">ATK {card.baseAtk}</span>
                <span className="text-green-400">DEF {card.baseDef}</span>
                <span className="text-yellow-400">PA {card.basePa}</span>
              </>
            )}
            {card.type === 'weapon' && <span className="text-red-400">+{card.atkBonus} ATK</span>}
            {card.type === 'shield' && <span className="text-green-400">+{card.defBonus} DEF</span>}
            {(card.type === 'item' || card.type === 'terrain') && (
              <span className="text-fantasy-silver text-xs">{card.desc}</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-fantasy-silver text-xs">Possedute:</span>
            <span className="font-display font-bold text-lg"
              style={{ color: owned > 0 ? '#c9a84c' : '#ff4444' }}>
              {owned}
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
export default function Collection() {
  const { user } = useAuth();
  const [owned, setOwned] = useState({});
  const [filter, setFilter] = useState('Tutti');
  const [search, setSearch] = useState('');
  const [zoomedCard, setZoomedCard] = useState(null);

  useEffect(() => {
    if (!user) return;
    getCollectionMap(user.id).then(setOwned);
  }, [user]);

  const filteredCards = useMemo(() => {
    return CARD_CATALOG.filter(c => {
      if (filter !== 'Tutti' && c.type !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filter, search]);

  const totalOwned = Object.values(owned).reduce((s, q) => s + q, 0);
  const uniqueOwned = Object.keys(owned).length;

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-display font-bold text-3xl text-white">
              La tua <span className="text-gold-gradient">Collezione</span>
            </h1>
          </div>
          <p className="text-fantasy-silver text-sm mb-6">
            Esplora tutte le carte. Clicca per ingrandirle.
          </p>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 mb-6 text-[11px]">
            <span className="px-3 py-1.5 bg-fantasy-card border border-fantasy-border rounded-lg text-fantasy-silver">
              📦 {uniqueOwned}/{CARD_CATALOG.length} carte uniche
            </span>
            <span className="px-3 py-1.5 bg-fantasy-card border border-fantasy-border rounded-lg text-fantasy-silver">
              🃏 {totalOwned} carte totali
            </span>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca carta…"
              className="flex-1 px-3 py-2 bg-fantasy-card border border-fantasy-border rounded-lg text-white text-sm placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
            />
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    filter === key
                      ? 'border-fantasy-gold bg-fantasy-gold/10 text-fantasy-gold'
                      : 'border-fantasy-border text-fantasy-silver hover:text-white hover:border-fantasy-gold/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredCards.map(card => {
              const qty = owned[card.catalogId] ?? 0;
              const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];
              return (
                <button
                  key={card.catalogId}
                  onClick={() => { setZoomedCard(card); playMedievalSound('click'); }}
                  className="relative rounded-xl overflow-hidden text-left transition-all duration-200 hover:-translate-y-1"
                  style={{
                    background: qty > 0 ? '#12121a' : '#0a0a0f',
                    border: `2px solid ${qty > 0 ? borderColor : '#1a1a2a'}`,
                    opacity: qty > 0 ? 1 : 0.35,
                  }}
                >
                  <div className="aspect-[3/4] p-2 flex flex-col items-center justify-between">
                    <span className="text-2xl">{TYPE_ICONS[card.type]}</span>
                    <div className="text-center">
                      <p className="font-display font-semibold text-white text-[10px] leading-tight">{card.name}</p>
                      <p className="text-[8px] mt-0.5" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
                    </div>
                    <div className="text-[8px] text-fantasy-silver">
                      {card.type === 'knight' && `ATK:${card.baseAtk} DEF:${card.baseDef} PA:${card.basePa}`}
                      {card.type === 'weapon' && `+${card.atkBonus} ATK`}
                      {card.type === 'shield' && `+${card.defBonus} DEF`}
                      {(card.type === 'item' || card.type === 'terrain') && card.desc}
                    </div>
                  </div>
                  {/* Quantity badge */}
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: qty > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,50,50,0.2)',
                      color: qty > 0 ? '#c9a84c' : '#ff4444',
                    }}
                  >
                    x{qty}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredCards.length === 0 && (
            <p className="text-center text-fantasy-silver/40 text-sm py-12">
              Nessuna carta trovata.
            </p>
          )}
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomedCard && (
        <CardZoom
          card={zoomedCard}
          owned={owned[zoomedCard.catalogId] ?? 0}
          onClose={() => setZoomedCard(null)}
        />
      )}
    </div>
  );
}
