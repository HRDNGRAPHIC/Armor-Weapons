import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import { CARD_CATALOG, TYPE_LABELS_IT, RARITIES } from '../game/data/cardCatalog';
import { useAuth } from '../context/AuthContext';
import { getCollectionMap, getNewCards, markCardSeen } from '../services/collection';
import { playMedievalSound } from '../game/data/medievalAudio';
import SmartFilter from '../components/SmartFilter';

const TYPE_ICONS = {
  knight: '⚔️', weapon: '🗡️', shield: '🛡️', item: '🧪', terrain: '🌍',
};

const RARITY_BORDER = {
  leggendaria: '#c9a84c',
  epica: '#8b5fbf',
  rara: '#2a5da8',
  comune: '#5a5a7a',
};

const ZOOM_DURATION = 0.3;

/* ── Zoom Overlay with 3D tilt + badge (inspection only) ── */
function CardZoom({ card, owned, isNew, onClose, layoutId }) {
  const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -15;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 15;
    setTilt({ rotateX, rotateY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ backgroundColor: 'rgba(0,0,0,0)', backdropFilter: 'blur(0px)' }}
      animate={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      exit={{ backgroundColor: 'rgba(0,0,0,0)', backdropFilter: 'blur(0px)' }}
      transition={{ duration: ZOOM_DURATION, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        ref={cardRef}
        layoutId={layoutId}
        className="relative max-w-sm w-full mx-4 rounded-2xl overflow-hidden"
        style={{
          background: '#12121a',
          border: `3px solid ${borderColor}`,
          boxShadow: `0 0 40px ${borderColor}44`,
          perspective: 800,
          transformStyle: 'preserve-3d',
        }}
        animate={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={e => e.stopPropagation()}
      >
        {/* Badge pulsante "NUOVA" — mostrato solo all'ispezione con zoom */}
        {isNew && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Nuova</span>
          </div>
        )}

        {/* Area artwork */}
        <div className="aspect-[3/4] bg-black flex items-center justify-center p-6">
          <span className="text-7xl">{TYPE_ICONS[card.type]}</span>
        </div>

        {/* Informazioni */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold text-white text-lg leading-tight">{card.name}</h3>
            <span className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: `${card.rarity?.color}22`, color: card.rarity?.color }}>
              {card.rarity?.label}
            </span>
          </div>

          <div className="flex gap-4 mb-3 text-sm">
            {card.type === 'knight' && (
              <>
                <span className="text-red-400">ATK {card.baseAtk}</span>
                <span className="text-green-400">DEF {card.baseDef}</span>
                <span className="text-yellow-400">PA {card.basePa}</span>
              </>
            )}
            {card.type === 'weapon' && <><span className="text-red-400">+{card.atkBonus} ATK</span><span className="text-yellow-400">CU {card.cu}</span></>}
            {card.type === 'shield' && <><span className="text-green-400">+{card.defBonus} DEF</span><span className="text-yellow-400">CU {card.cu}</span></>}
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

        {/* Pulsante chiudi */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition text-sm"
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════ */
export default function Collection() {
  const { user } = useAuth();
  const [owned, setOwned] = useState({});
  const [newCards, setNewCards] = useState(new Set());
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedRarities, setSelectedRarities] = useState(new Set());
  const [search, setSearch] = useState('');
  const [zoomedCard, setZoomedCard] = useState(null);

  useEffect(() => {
    if (!user) return;
    getCollectionMap(user.id).then(setOwned);
    getNewCards(user.id).then(setNewCards);
  }, [user]);

  // Apri zoom — nessun effetto collaterale qui
  const handleZoom = useCallback((card) => {
    playMedievalSound('click');
    setZoomedCard(card);
  }, []);

  // Chiudi zoom — segna come vista alla chiusura se era nuova
  const handleCloseZoom = useCallback(() => {
    if (zoomedCard && user && newCards.has(zoomedCard.catalogId)) {
      markCardSeen(user.id, zoomedCard.catalogId);
      setNewCards(prev => {
        const next = new Set(prev);
        next.delete(zoomedCard.catalogId);
        return next;
      });
    }
    setZoomedCard(null);
  }, [zoomedCard, user, newCards]);

  const filteredCards = useMemo(() => {
    return CARD_CATALOG.filter(c => {
      if (selectedTypes.size > 0 && !selectedTypes.has(c.type)) return false;
      if (selectedRarities.size > 0 && !selectedRarities.has(c.rarity?.id)) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [selectedTypes, selectedRarities, search]);

  const uniqueOwned = Object.keys(owned).length;

  const rarityStats = useMemo(() => RARITIES.map(r => ({
    id: r.id,
    label: r.label,
    color: r.color,
    total: CARD_CATALOG.filter(c => c.rarity?.id === r.id).length,
    unique: CARD_CATALOG.filter(c => c.rarity?.id === r.id && (owned[c.catalogId] ?? 0) > 0).length,
  })), [owned]);

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-white mb-1">
            La tua <span className="text-gold-gradient">Collezione</span>
          </h1>
          <p className="text-fantasy-silver text-sm mb-6">
            Esplora tutte le carte. Clicca per ingrandirle.
          </p>

          <div className="flex gap-6">
            {/* ── Barra laterale (schermi grandi) ── */}
            <aside className="hidden lg:block w-52 flex-shrink-0">
              <div className="sticky top-24 rounded-xl border border-fantasy-gold/20 bg-fantasy-card p-4">
                <h2 className="font-display font-bold text-fantasy-gold text-[11px] uppercase tracking-widest mb-4">
                  Progresso
                </h2>
                <div className="space-y-2.5">
                  {rarityStats.map(r => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span className="text-xs font-display" style={{ color: r.color }}>{r.label}</span>
                      <span className="text-xs font-mono text-fantasy-silver">
                        <span style={{ color: r.color }}>{r.unique}</span>
                        <span className="opacity-30 mx-0.5">/</span>
                        {r.total}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-fantasy-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display text-white uppercase tracking-wide">Totale</span>
                    <span className="text-xs font-mono">
                      <span className="text-fantasy-gold">{uniqueOwned}</span>
                      <span className="opacity-30 mx-0.5">/</span>
                      <span className="text-fantasy-silver">{CARD_CATALOG.length}</span>
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Contenuto principale ── */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca carta…"
                  className="flex-1 px-3 py-2 bg-fantasy-card border border-fantasy-border rounded-lg text-white text-sm placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
                />
                <SmartFilter
                  typeOptions={TYPE_LABELS_IT}
                  rarityOptions={RARITIES}
                  selectedTypes={selectedTypes}
                  selectedRarities={selectedRarities}
                  onChange={(types, rarities) => { setSelectedTypes(types); setSelectedRarities(rarities); }}
                />
              </div>

              {/* Statistiche mobile — riga compatta, nascosta su lg+ */}
              <div className="flex flex-wrap gap-2 mb-4 lg:hidden">
                {rarityStats.map(r => (
                  <span key={r.id} className="px-2 py-1 bg-fantasy-card border border-fantasy-border rounded-lg text-[10px] font-display"
                    style={{ color: r.color }}>
                    {r.label}: {r.unique}/{r.total}
                  </span>
                ))}
              </div>

              {/* Griglia carte */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredCards.map(card => {
              const qty = owned[card.catalogId] ?? 0;
              const isNew = qty > 0 && newCards.has(card.catalogId);
              const borderColor = RARITY_BORDER[card.rarity?.id ?? 'comune'];
              return (
                <motion.div
                  key={card.catalogId}
                  layoutId={`card-${card.catalogId}`}
                  onClick={() => handleZoom(card)}
                  className="relative rounded-xl overflow-hidden text-left cursor-pointer transition-transform duration-200 hover:scale-[1.03]"
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
                      {card.type === 'weapon' && `+${card.atkBonus} ATK · CU ${card.cu}`}
                      {card.type === 'shield' && `+${card.defBonus} DEF · CU ${card.cu}`}
                      {(card.type === 'item' || card.type === 'terrain') && card.desc}
                    </div>
                  </div>
                  {/* Badge quantità */}
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: qty > 0 ? 'rgba(201,168,76,0.2)' : 'rgba(255,50,50,0.2)',
                      color: qty > 0 ? '#c9a84c' : '#ff4444',
                    }}
                  >
                    x{qty}
                  </div>
                  {/* Badge carta nuova */}
                  {isNew && (
                    <span className="absolute top-1 left-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {filteredCards.length === 0 && (
            <p className="text-center text-fantasy-silver/40 text-sm py-12">
              Nessuna carta trovata.
            </p>
          )}
            </div>{/* fine flex-1 min-w-0 */}
          </div>{/* fine flex gap-6 */}
        </div>
      </div>

      {/* Overlay zoom — inclinazione 3D + badge attivo SOLO QUI */}
      <AnimatePresence>
        {zoomedCard && (
          <CardZoom
            card={zoomedCard}
            owned={owned[zoomedCard.catalogId] ?? 0}
            isNew={newCards.has(zoomedCard.catalogId)}
            onClose={handleCloseZoom}
            layoutId={`card-${zoomedCard.catalogId}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
