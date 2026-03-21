/*
 * ChestOpening.jsx — Cinematic Starter Chest opening animation.
 * Uses baule_chiuso.png / baule_aperto.png with shaking, particles,
 * light beams, metallic sounds, and flying cards.
 */
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_CATALOG } from '../game/data/cardCatalog';
import { playMedievalSound } from '../game/data/medievalAudio';
import { claimStarterChest } from '../services/starterChest';
import { useAuth } from '../context/AuthContext';
import bauleChiuso from '../assets/baule_chiuso.png';
import bauleAperto from '../assets/baule_aperto.png';

const TYPE_ICONS = {
  knight: '⚔️', weapon: '🗡️', shield: '🛡️', item: '🧪', terrain: '🌍',
};

const RARITY_COLORS = {
  leggendaria: { border: '#c9a84c', glow: '#ffd700', particle: '#f5d442' },
  epica:       { border: '#8b5fbf', glow: '#a855f7', particle: '#c084fc' },
  rara:        { border: '#2a5da8', glow: '#3b82f6', particle: '#60a5fa' },
  comune:      { border: '#5a5a7a', glow: '#6b7280', particle: '#9ca3af' },
};

/* ── Heavy Particles ──────────────────────────────── */
function ChestParticles({ active }) {
  const particles = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 50 + (Math.random() - 0.5) * 20,
      size: Math.random() * 8 + 3,
      delay: Math.random() * 0.8,
      dur: Math.random() * 2 + 1.5,
      dx: (Math.random() - 0.5) * 600,
      dy: -(Math.random() * 500 + 100),
      color: ['#c9a84c', '#ffd700', '#ff6b35', '#e8e8e8', '#a855f7', '#ff4444'][Math.floor(Math.random() * 6)],
    }))
  ).current;

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            x: [0, p.dx],
            y: [0, p.dy],
            opacity: [0, 1, 1, 0],
            scale: [0, 2.5, 1.5, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

/* ── Light Beams ──────────────────────────────────── */
function LightBeams({ active }) {
  if (!active) return null;
  const beams = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    rotation: (i / 12) * 360,
    delay: i * 0.05,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none z-15 flex items-center justify-center">
      {beams.map(b => (
        <motion.div
          key={b.id}
          className="absolute"
          style={{
            width: 4,
            height: '80%',
            background: 'linear-gradient(to top, rgba(255,215,0,0.6), transparent)',
            transformOrigin: 'center bottom',
            rotate: b.rotation,
          }}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: [0, 0.8, 0], scaleY: [0, 1, 0.5] }}
          transition={{ duration: 2, delay: b.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

/* ── Flying Card ──────────────────────────────────── */
function FlyingCard({ card, index, total }) {
  const rarityId = card.rarity?.id ?? 'comune';
  const colors = RARITY_COLORS[rarityId];
  const angle = ((index / total) * 360 - 90) * (Math.PI / 180);
  const radius = 130;
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius - 30;

  return (
    <motion.div
      className="absolute rounded-xl overflow-hidden"
      style={{
        width: 80, height: 110,
        background: '#12121a',
        border: `2px solid ${colors.border}`,
        boxShadow: `0 0 20px ${colors.glow}44`,
        left: '50%', top: '50%',
        marginLeft: -40, marginTop: -55,
      }}
      initial={{ x: 0, y: 40, scale: 0, opacity: 0, rotateY: 180 }}
      animate={{
        x: targetX,
        y: targetY,
        scale: 1,
        opacity: 1,
        rotateY: 0,
      }}
      transition={{
        duration: 0.8,
        delay: index * 0.15,
        type: 'spring',
        stiffness: 100,
      }}
    >
      <div className="h-full flex flex-col items-center justify-between p-2">
        <span className="text-xl">{TYPE_ICONS[card.type]}</span>
        <div className="text-center">
          <p className="font-display font-semibold text-white text-[8px] leading-tight">{card.name}</p>
          <p className="text-[7px] mt-0.5" style={{ color: card.rarity?.color }}>{card.rarity?.label}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
 * ChestOpening — Main Component
 * Props: onClose, onCardsAdded
 * ══════════════════════════════════════════════════════ */
export default function ChestOpening({ onClose, onCardsAdded }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState('sealed');    // sealed → shaking → opening → reveal → done
  const [starterCards, setStarterCards] = useState([]);
  const [displayCards, setDisplayCards] = useState([]);
  const [claiming, setClaiming] = useState(false);

  const handleOpenChest = useCallback(async () => {
    if (claiming || !user) return;
    setClaiming(true);

    // Phase: shaking — metallic rattling
    playMedievalSound('metal');
    setPhase('shaking');
    await new Promise(r => setTimeout(r, 800));
    playMedievalSound('armor');
    await new Promise(r => setTimeout(r, 1200));

    // Phase: opening burst — heavy seal break
    playMedievalSound('packOpen');
    setPhase('opening');
    await new Promise(r => setTimeout(r, 1800));

    // Claim the chest from Supabase
    const cards = await claimStarterChest(user.id);
    setStarterCards(cards);

    // Pick 5-6 representative cards (prioritize higher rarity)
    const catalogIds = cards.map(c => c.catalogId);
    const unique = [...new Set(catalogIds)];
    const display = unique
      .map(id => CARD_CATALOG.find(c => c.catalogId === id))
      .filter(Boolean)
      .sort((a, b) => {
        const order = { leggendaria: 0, epica: 1, rara: 2, comune: 3 };
        return (order[a.rarity?.id] ?? 3) - (order[b.rarity?.id] ?? 3);
      })
      .slice(0, 6);
    setDisplayCards(display);

    playMedievalSound('armor');

    // Phase: reveal — flying cards from chest mouth
    setPhase('reveal');
    await new Promise(r => setTimeout(r, display.length * 150 + 2000));

    playMedievalSound('legendary');
    setPhase('done');
    setClaiming(false);
  }, [user, claiming]);

  const handleClose = useCallback(() => {
    playMedievalSound('click');
    if (onCardsAdded) onCardsAdded(starterCards);
    if (onClose) onClose();
  }, [onClose, onCardsAdded, starterCards]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Particle effects during opening & reveal */}
      <ChestParticles active={phase === 'opening' || phase === 'reveal'} />
      <LightBeams active={phase === 'opening'} />

      {/* Content */}
      <div className="relative z-30 flex flex-col items-center">
        {/* ═══ SEALED CHEST — Real asset ═══ */}
        {phase === 'sealed' && (
          <motion.div
            className="flex flex-col items-center cursor-pointer"
            onClick={handleOpenChest}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.img
              src={bauleChiuso}
              alt="Forziere chiuso"
              className="w-56 h-auto drop-shadow-[0_0_40px_rgba(139,105,20,0.5)]"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.p
              className="mt-6 text-fantasy-gold font-display font-bold text-lg"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Tocca per Aprire il Forziere
            </motion.p>
            <p className="text-fantasy-silver text-xs mt-2">Forziere Starter — 50 Carte</p>
          </motion.div>
        )}

        {/* ═══ SHAKING CHEST — Violent rattling ═══ */}
        {phase === 'shaking' && (
          <motion.div className="flex flex-col items-center">
            <motion.img
              src={bauleChiuso}
              alt="Forziere che trema"
              className="w-56 h-auto"
              style={{
                filter: 'drop-shadow(0 0 60px rgba(201,168,76,0.7))',
              }}
              animate={{
                x: [0, -12, 12, -16, 16, -20, 20, -8, 8, 0],
                rotate: [0, -3, 3, -5, 5, -7, 7, -3, 3, 0],
                scale: [1, 1.02, 1, 1.04, 1, 1.06, 1, 1.04, 1.02, 1.08],
              }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />
          </motion.div>
        )}

        {/* ═══ OPENING — Asset transforms to open chest + burst ═══ */}
        {phase === 'opening' && (
          <motion.div className="flex flex-col items-center relative">
            <motion.img
              src={bauleAperto}
              alt="Forziere aperto"
              className="w-64 h-auto"
              style={{
                filter: 'drop-shadow(0 0 80px rgba(255,215,0,0.8))',
              }}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: [1.1, 1.3, 1.15], opacity: [0, 1, 1] }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
            {/* Golden radial glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)' }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0.5], scale: [0.5, 2, 2.5] }}
              transition={{ duration: 1.5 }}
            />
          </motion.div>
        )}

        {/* ═══ REVEAL — Open chest + flying cards from its mouth ═══ */}
        {phase === 'reveal' && (
          <div className="relative flex flex-col items-center">
            {/* Open chest stays visible */}
            <motion.img
              src={bauleAperto}
              alt="Forziere aperto"
              className="w-56 h-auto relative z-10"
              style={{ filter: 'drop-shadow(0 0 40px rgba(201,168,76,0.5))' }}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            />
            {/* Cards fly out from chest */}
            <div className="absolute w-80 h-80 flex items-center justify-center" style={{ top: '-80px' }}>
              {displayCards.map((card, i) => (
                <FlyingCard key={card.catalogId} card={card} index={i} total={displayCards.length} />
              ))}
            </div>
            <motion.p
              className="mt-8 text-fantasy-gold font-display font-bold text-sm text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: displayCards.length * 0.15 + 0.5 }}
            >
              +50 carte aggiunte alla collezione!
            </motion.p>
          </div>
        )}

        {/* ═══ DONE — Summary ═══ */}
        {phase === 'done' && (
          <motion.div
            className="max-w-md w-full mx-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <div className="bg-fantasy-card border border-fantasy-gold/40 rounded-2xl p-6 text-center">
              <img src={bauleAperto} alt="Forziere" className="w-24 h-auto mx-auto mb-4 opacity-60" />
              <h2 className="font-display font-bold text-2xl text-fantasy-gold mb-2">
                Forziere Aperto!
              </h2>
              <p className="text-fantasy-silver text-sm mb-4">
                50 carte sono state aggiunte alla tua collezione.
              </p>

              {/* Preview grid of the shown cards */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                {displayCards.map(card => {
                  const colors = RARITY_COLORS[card.rarity?.id ?? 'comune'];
                  return (
                    <div
                      key={card.catalogId}
                      className="rounded-lg p-1.5 text-center"
                      style={{
                        background: '#0e0e16',
                        border: `1px solid ${colors.border}`,
                        boxShadow: `0 0 8px ${colors.glow}33`,
                      }}
                    >
                      <span className="text-lg">{TYPE_ICONS[card.type]}</span>
                      <p className="text-[7px] text-white font-display leading-tight truncate mt-0.5">{card.name}</p>
                    </div>
                  );
                })}
              </div>

              <p className="text-fantasy-silver text-xs mb-4">
                {starterCards.length} tipi di carte unici
              </p>

              <button
                onClick={handleClose}
                className="w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition"
                style={{
                  background: 'linear-gradient(135deg, #c9a84c, #e4c96a)',
                  color: '#0a0a0f',
                }}
              >
                Continua →
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
