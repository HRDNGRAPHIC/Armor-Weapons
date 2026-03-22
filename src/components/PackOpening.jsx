/*
 * PackOpening.jsx — Cinematic pack unboxing experience.
 * Framer Motion: AnimatePresence, drag-to-swipe cards, particles.
 * Audio: Medieval Dark Fantasy (parchment, bells, metal).
 * Persistence: writes to user_collection via Supabase.
 */
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_CATALOG, RARITIES } from '../game/data/cardCatalog';
import { playMedievalSound } from '../game/data/medievalAudio';
import { addCardsToCollection } from '../services/collection';
import { redeemPack } from '../services/packs';
import { useAuth } from '../context/AuthContext';
import TiltCard from './TiltCard';

/* ── Particles ────────────────────────────────────── */
function Particles({ count = 30, color = '#c9a84c' }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 2,
      dur: Math.random() * 3 + 2,
      dx: (Math.random() - 0.5) * 200,
      dy: (Math.random() - 0.5) * 200,
    }))
  ).current;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
          animate={{
            x: [0, p.dx, 0],
            y: [0, p.dy, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1.5, 0.5],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ── Rarity color maps ────────────────────────────── */
const RARITY_COLORS = {
  leggendaria: { border: '#c9a84c', glow: 'rgba(201,168,76,0.6)', particles: '#ffd700' },
  epica:       { border: '#8b5fbf', glow: 'rgba(139,95,191,0.5)', particles: '#b388ff' },
  rara:        { border: '#2a5da8', glow: 'rgba(42,93,168,0.4)',  particles: '#64b5f6' },
  comune:      { border: '#5a5a7a', glow: 'rgba(90,90,122,0.3)', particles: '#8a8a9a' },
};

const TYPE_ICONS = {
  knight: '⚔️', weapon: '🗡️', shield: '🛡️', item: '🧪', terrain: '🌍',
};

/* ── Drop Rate Algorithm ──────────────────────────
 * Standard: 90% Comune, 7% Rara, 2% Epica, 1% Leggendaria (= 100%)
 * Premium:  80% Rara, 15% Epica, 5% Leggendaria (no comuni, = 100%)
 * ───────────────────────────────────────────────── */
const STANDARD_RATES = [
  { id: 'comune',      threshold: 90 },  // 0-89.999 → comune (90%)
  { id: 'rara',        threshold: 97 },  // 90-96.999 → rara (7%)
  { id: 'epica',       threshold: 99 },  // 97-98.999 → epica (2%)
  { id: 'leggendaria', threshold: 100 }, // 99-99.999 → leggendaria (1%)
];

const PREMIUM_RATES = [
  { id: 'rara',        threshold: 80 },  // 0-79.999 → rara (80%)
  { id: 'epica',       threshold: 95 },  // 80-94.999 → epica (15%)
  { id: 'leggendaria', threshold: 100 }, // 95-99.999 → leggendaria (5%)
];

function rollRarityFromTable(rates) {
  const r = Math.random() * 100;
  for (const entry of rates) {
    if (r < entry.threshold) return RARITIES.find(rv => rv.id === entry.id);
  }
  return RARITIES.find(rv => rv.id === rates[rates.length - 1].id);
}

/**
 * Generate a pack of 5 cards.
 * @param {'standard'|'premium'} tier — standard uses all rarities, premium excludes comuni
 * @param {string|null} typeFilter — 'knight','weapon','shield','item','terrain' or null for mix
 */
function generatePack(tier, typeFilter) {
  const rates = tier === 'premium' ? PREMIUM_RATES : STANDARD_RATES;
  const pool = typeFilter
    ? CARD_CATALOG.filter(c => c.type === typeFilter)
    : CARD_CATALOG;

  const cards = [];
  for (let i = 0; i < 5; i++) {
    const rarity = rollRarityFromTable(rates);
    const eligible = pool.filter(c => c.rarity.id === rarity.id);
    // Fallback: if no cards of that rarity exist for this type, pick any from pool
    const pick = eligible.length > 0
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : pool[Math.floor(Math.random() * pool.length)];
    cards.push({ ...pick, rarity: pick.rarity });
  }
  return cards;
}

/* ── Swipeable Card Stack ─────────────────────────── */
function SwipeCardStack({ cards, onAllRevealed }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const currentCard = cards[currentIdx];
  const nextCard = cards[currentIdx + 1];
  const rc = RARITY_COLORS[currentCard?.rarity?.id] ?? RARITY_COLORS.comune;

  const onDragEnd = useCallback((_, info) => {
    const threshold = 80;
    if (Math.abs(info.offset.x) > threshold || Math.abs(info.offset.y) > threshold) {
      playMedievalSound('swipe');
      if (currentIdx < cards.length - 1) {
        setCurrentIdx(i => i + 1);
        setTimeout(() => playMedievalSound('cardReveal'), 200);
      } else {
        onAllRevealed();
      }
    }
  }, [currentIdx, cards.length, onAllRevealed]);

  if (!currentCard) return null;

  return (
    <div className="relative w-56 h-80 sm:w-64 sm:h-96 mx-auto">
      {/* Next card underneath (preview) */}
      {nextCard && (
        <div
          className="absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center"
          style={{
            background: '#12121a',
            borderColor: RARITY_COLORS[nextCard.rarity?.id]?.border ?? '#5a5a7a',
            transform: 'scale(0.95)',
            opacity: 0.5,
          }}
        >
          <span className="text-3xl opacity-30">🃏</span>
        </div>
      )}

      {/* Current top card — draggable */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIdx}
          className="absolute inset-0 rounded-2xl border-2 cursor-grab active:cursor-grabbing flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #12121a 0%, #1a1a2e 50%, #12121a 100%)',
            borderColor: rc.border,
            boxShadow: `0 0 30px ${rc.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
          }}
          initial={{ scale: 0.5, rotateY: 180, opacity: 0 }}
          animate={{ scale: 1, rotateY: 0, opacity: 1 }}
          exit={{ x: 300, rotate: 20, opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragEnd={onDragEnd}
          whileDrag={{ scale: 1.05, rotate: 5 }}
        >
          {/* Rarity glow overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 50% 30%, ${rc.glow} 0%, transparent 60%)`,
          }} />

          {/* Card header */}
          <div className="px-3 py-2 text-center border-b" style={{ borderColor: rc.border, background: 'rgba(0,0,0,0.4)' }}>
            <p className="font-display text-xs sm:text-sm font-bold" style={{ color: '#e2d1a3' }}>
              {currentCard.name}
            </p>
            <p className="text-[10px] font-bold mt-0.5" style={{ color: rc.border }}>
              {currentCard.rarity.label}
            </p>
          </div>

          {/* Card art area */}
          <div className="flex-1 flex items-center justify-center relative">
            <span className="text-6xl sm:text-7xl filter drop-shadow-lg">
              {TYPE_ICONS[currentCard.type]}
            </span>
            {currentCard.rarity.id === 'leggendaria' && (
              <Particles count={20} color={rc.particles} />
            )}
            {currentCard.rarity.id === 'epica' && (
              <Particles count={12} color={rc.particles} />
            )}
          </div>

          {/* Card stats */}
          <div className="px-3 py-3 text-center border-t" style={{ borderColor: rc.border, background: 'rgba(0,0,0,0.4)' }}>
            <div className="text-xs text-gray-300">
              {currentCard.type === 'knight' && (
                <div className="flex justify-center gap-4">
                  <span style={{ color: '#ff4444' }}>ATK {currentCard.baseAtk}</span>
                  <span style={{ color: '#44ff44' }}>DEF {currentCard.baseDef}</span>
                  <span style={{ color: '#ffd700' }}>PA {currentCard.basePa}</span>
                </div>
              )}
              {currentCard.type === 'weapon' && <><span style={{ color: '#ff4444' }}>+{currentCard.atkBonus} ATK</span>{' '}<span style={{ color: '#ffd700' }}>CU {currentCard.cu}</span></>}
              {currentCard.type === 'shield' && <><span style={{ color: '#44ff44' }}>+{currentCard.defBonus} DEF</span>{' '}<span style={{ color: '#ffd700' }}>CU {currentCard.cu}</span></>}
              {(currentCard.type === 'item' || currentCard.type === 'terrain') && (
                <span style={{ color: '#ffd700' }}>{currentCard.desc}</span>
              )}
            </div>
          </div>

          {/* Swipe hint */}
          <div className="absolute bottom-1 inset-x-0 text-center">
            <motion.p
              className="text-[10px] text-gray-500"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ← Trascina per rivelare →
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute -bottom-8 inset-x-0 flex justify-center gap-1.5">
        {cards.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i <= currentIdx ? '#c9a84c' : '#2a2a3a',
              transform: i === currentIdx ? 'scale(1.3)' : 'scale(1)',
              boxShadow: i <= currentIdx ? '0 0 6px rgba(201,168,76,0.5)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════ Main PackOpening Component ═══════════ */
export default function PackOpening({ packTier = 'standard', typeFilter = null, packId = null, onClose, onCardsAdded }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('sealed'); // sealed | cutting | reveal | done
  const [cards, setCards] = useState([]);
  const [saving, setSaving] = useState(false);

  const openPack = useCallback(() => {
    playMedievalSound('packOpen');
    setPhase('cutting');

    const rolled = generatePack(packTier, typeFilter);
    setCards(rolled);

    setTimeout(() => {
      playMedievalSound('bell');
      setPhase('reveal');
      setTimeout(() => playMedievalSound('cardReveal'), 400);
    }, 1400);
  }, [packTier, typeFilter]);

  const onAllRevealed = useCallback(() => {
    playMedievalSound('armor');
    setPhase('done');
  }, []);

  const saveAndClose = useCallback(async () => {
    if (!user || cards.length === 0) { onClose?.(); return; }
    setSaving(true);
    try {
      const cardsToAdd = cards.map(c => ({ catalogId: c.catalogId }));
      await addCardsToCollection(user.id, cardsToAdd);
      if (packId) await redeemPack(user.id, packId);
      playMedievalSound('save');
      onCardsAdded?.(cards);
    } catch (err) {
      console.error('Save cards error:', err);
    } finally {
      setSaving(false);
      onClose?.();
    }
  }, [user, cards, packId, onClose, onCardsAdded]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <Particles count={40} color="#c9a84c44" />

        <div className="relative z-20 w-full max-w-md px-4">
          {/* ── SEALED PACK ─────────────────────────── */}
          {phase === 'sealed' && (
            <motion.div className="flex flex-col items-center gap-6">
              <motion.div
                onClick={openPack}
                className="relative w-52 h-72 rounded-2xl border-2 border-fantasy-gold flex items-center justify-center cursor-pointer overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, #1a1505 0%, #12121a 40%, #1a0a1a 100%)',
                  boxShadow: '0 0 40px rgba(201,168,76,0.25), inset 0 0 60px rgba(0,0,0,0.5)',
                }}
                whileHover={{ scale: 1.05, boxShadow: '0 0 60px rgba(201,168,76,0.4)' }}
                whileTap={{ scale: 0.95 }}
                animate={{ y: [0, -8, 0] }}
                transition={{ y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}
              >
                {/* Wax seal */}
                <div className="absolute top-6 w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle, #8a0303 30%, #5a0202 100%)', boxShadow: '0 4px 12px rgba(138,3,3,0.6)' }}
                >
                  <span className="text-2xl">🛡️</span>
                </div>

                <div className="text-center mt-10">
                  <span className="text-5xl block mb-3">🃏</span>
                  <p className="font-display font-bold text-sm" style={{ color: '#c9a84c' }}>
                    {packTier === 'premium' ? 'Pack Premium' : 'Pack Standard'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">5 carte</p>
                </div>

                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 55%, transparent 60%)' }}
                  animate={{ x: [-200, 300] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>

              <motion.p
                className="text-gray-400 text-sm font-display"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Tocca per spezzare il sigillo
              </motion.p>
            </motion.div>
          )}

          {/* ── CUTTING ANIMATION ───────────────────── */}
          {phase === 'cutting' && (
            <motion.div className="flex items-center justify-center h-72 relative">
              <motion.div
                className="absolute w-52 h-72 rounded-2xl border-2 border-fantasy-gold overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #1a1505 0%, #12121a 100%)', clipPath: 'inset(0 50% 0 0)' }}
                animate={{ x: -80, rotate: -12, opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute w-52 h-72 rounded-2xl border-2 border-fantasy-gold overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #1a1505 0%, #12121a 100%)', clipPath: 'inset(0 0 0 50%)' }}
                animate={{ x: 80, rotate: 12, opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute w-4 h-72 rounded-full"
                style={{ background: 'linear-gradient(180deg, transparent, #c9a84c, #ffd700, #c9a84c, transparent)' }}
                initial={{ scaleX: 1, opacity: 1 }}
                animate={{ scaleX: [1, 40, 0], opacity: [1, 0.8, 0] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              <Particles count={50} color="#c9a84c" />
            </motion.div>
          )}

          {/* ── CARD REVEAL (Swipe Stack) ───────────── */}
          {phase === 'reveal' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <SwipeCardStack cards={cards} onAllRevealed={onAllRevealed} />
            </motion.div>
          )}

          {/* ── ALL DONE ────────────────────────────── */}
          {phase === 'done' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h3 className="font-display font-bold text-xl text-white mb-6">
                Carte Ottenute!
              </h3>
              <div className="flex justify-center gap-3 flex-wrap mb-8">
                {cards.map((card, i) => {
                  const rc = RARITY_COLORS[card.rarity?.id] ?? RARITY_COLORS.comune;
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, rotate: -10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.1, type: 'spring', stiffness: 300 }}
                    >
                      <TiltCard
                        className="w-20 sm:w-24 rounded-xl border-2 overflow-hidden"
                        style={{
                          borderColor: rc.border,
                          background: '#12121a',
                          boxShadow: `0 0 12px ${rc.glow}`,
                        }}
                      >
                        <div className="aspect-[3/4] p-1.5 flex flex-col items-center justify-between">
                          <span className="text-lg">{TYPE_ICONS[card.type]}</span>
                          <p className="font-display font-semibold text-white text-[8px] text-center leading-tight">{card.name}</p>
                          <p className="text-[7px] font-bold" style={{ color: rc.border }}>{card.rarity.label}</p>
                        </div>
                      </TiltCard>
                    </motion.div>
                  );
                })}
              </div>
              <button
                onClick={saveAndClose}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-display font-bold text-sm tracking-wider transition disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #c9a84c, #e4c96a)',
                  color: '#0a0a0f',
                }}
              >
                {saving ? 'Salvataggio…' : '✦ Riscatta & Chiudi'}
              </button>
            </motion.div>
          )}

          {phase === 'sealed' && (
            <button
              onClick={onClose}
              className="mt-6 w-full py-2 text-gray-500 text-xs hover:text-white transition font-display"
            >
              Annulla
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
