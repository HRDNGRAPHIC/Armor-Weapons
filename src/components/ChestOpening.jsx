/*
 * ChestOpening.jsx — Cinematic Starter Chest opening animation.
 * Medieval chest that shakes, opens with heavy particle effects,
 * metallic sounds, and flying cards.
 */
import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_CATALOG } from '../game/data/cardCatalog';
import { playMedievalSound } from '../game/data/medievalAudio';
import { claimStarterChest } from '../services/starterChest';
import { useAuth } from '../context/AuthContext';

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
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 30,
      y: 50 + (Math.random() - 0.5) * 20,
      size: Math.random() * 6 + 3,
      delay: Math.random() * 0.8,
      dur: Math.random() * 2 + 1.5,
      dx: (Math.random() - 0.5) * 500,
      dy: -(Math.random() * 400 + 100),
      color: ['#c9a84c', '#ffd700', '#ff6b35', '#e8e8e8', '#a855f7'][Math.floor(Math.random() * 5)],
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
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            x: [0, p.dx],
            y: [0, p.dy],
            opacity: [0, 1, 1, 0],
            scale: [0, 2, 1.5, 0],
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

/* ── Flying Card ──────────────────────────────────── */
function FlyingCard({ card, index, total }) {
  const rarityId = card.rarity?.id ?? 'comune';
  const colors = RARITY_COLORS[rarityId];
  const angle = ((index / total) * 360 - 90) * (Math.PI / 180);
  const radius = 120;
  const targetX = Math.cos(angle) * radius;
  const targetY = Math.sin(angle) * radius;

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
      initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotateY: 180 }}
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
  const [starterCards, setStarterCards] = useState([]); // array of { catalogId, quantity }
  const [displayCards, setDisplayCards] = useState([]); // 9-10 representative cards to show
  const [claiming, setClaiming] = useState(false);

  const handleOpenChest = useCallback(async () => {
    if (claiming || !user) return;
    setClaiming(true);
    playMedievalSound('metal');

    // Phase: shaking
    setPhase('shaking');
    await new Promise(r => setTimeout(r, 2000));

    playMedievalSound('packOpen');

    // Phase: opening (burst)
    setPhase('opening');
    await new Promise(r => setTimeout(r, 1500));

    // Claim the chest from Supabase
    const cards = await claimStarterChest(user.id);
    setStarterCards(cards);

    // Pick 9-10 representative cards to display
    const catalogIds = cards.map(c => c.catalogId);
    const unique = [...new Set(catalogIds)];
    const display = unique
      .slice(0, 10)
      .map(id => CARD_CATALOG.find(c => c.catalogId === id))
      .filter(Boolean);
    setDisplayCards(display);

    playMedievalSound('armor');

    // Phase: reveal (flying cards)
    setPhase('reveal');
    await new Promise(r => setTimeout(r, display.length * 150 + 1500));

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

      {/* Particle effects during opening */}
      <ChestParticles active={phase === 'opening' || phase === 'reveal'} />

      {/* Content */}
      <div className="relative z-30 flex flex-col items-center">
        {/* ═══ SEALED CHEST ═══ */}
        {phase === 'sealed' && (
          <motion.div
            className="flex flex-col items-center cursor-pointer"
            onClick={handleOpenChest}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-48 h-40 rounded-2xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #3a2810, #5a3a18, #3a2810)',
                border: '4px solid #8B6914',
                boxShadow: '0 0 60px rgba(139,105,20,0.4), inset 0 0 30px rgba(0,0,0,0.5)',
              }}
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {/* Lock */}
              <div className="text-6xl">🔒</div>
              {/* Metal bands */}
              <div className="absolute top-3 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-700 to-transparent opacity-60" />
              <div className="absolute bottom-3 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-700 to-transparent opacity-60" />
              {/* Corner rivets */}
              <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-amber-600 border border-amber-800" />
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-amber-600 border border-amber-800" />
              <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-amber-600 border border-amber-800" />
              <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-amber-600 border border-amber-800" />
            </motion.div>

            <motion.p
              className="mt-6 text-fantasy-gold font-display font-bold text-lg"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Tocca per Aprire il Forziere
            </motion.p>
            <p className="text-fantasy-silver text-xs mt-2">Forziere Starter — 45 Carte</p>
          </motion.div>
        )}

        {/* ═══ SHAKING CHEST ═══ */}
        {phase === 'shaking' && (
          <motion.div
            className="w-48 h-40 rounded-2xl flex items-center justify-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #3a2810, #5a3a18, #3a2810)',
              border: '4px solid #8B6914',
              boxShadow: '0 0 80px rgba(201,168,76,0.6), inset 0 0 30px rgba(0,0,0,0.5)',
            }}
            animate={{
              rotateY: [0, 10, -10, 15, -15, 20, -20, 360],
              scale: [1, 1.05, 1, 1.1, 1, 1.15, 1, 1.2],
              x: [0, -10, 10, -15, 15, -20, 20, 0],
            }}
            transition={{ duration: 2, ease: 'easeInOut' }}
          >
            <motion.div
              className="text-6xl"
              animate={{ rotate: [0, -20, 20, -30, 30, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
            >
              🔓
            </motion.div>
            <div className="absolute top-3 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
            <div className="absolute bottom-3 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
          </motion.div>
        )}

        {/* ═══ OPENING BURST ═══ */}
        {phase === 'opening' && (
          <motion.div
            className="w-48 h-40 rounded-2xl flex items-center justify-center relative"
            initial={{ scale: 1.2 }}
            animate={{ scale: [1.2, 2, 0], opacity: [1, 1, 0] }}
            transition={{ duration: 1.5, ease: 'easeIn' }}
            style={{
              background: 'linear-gradient(145deg, #5a3a18, #8B6914)',
              border: '4px solid #ffd700',
              boxShadow: '0 0 120px rgba(255,215,0,0.8)',
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.8), transparent)' }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1 }}
            />
          </motion.div>
        )}

        {/* ═══ REVEAL — Flying Cards ═══ */}
        {phase === 'reveal' && (
          <div className="relative w-80 h-80 flex items-center justify-center">
            {displayCards.map((card, i) => (
              <FlyingCard key={card.catalogId} card={card} index={i} total={displayCards.length} />
            ))}
            <motion.p
              className="absolute -bottom-16 text-fantasy-gold font-display font-bold text-sm text-center w-full"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: displayCards.length * 0.15 + 0.5 }}
            >
              +45 carte aggiunte!
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
              <h2 className="font-display font-bold text-2xl text-fantasy-gold mb-2">
                Forziere Aperto!
              </h2>
              <p className="text-fantasy-silver text-sm mb-4">
                45 carte sono state aggiunte alla tua collezione.
              </p>

              {/* Preview grid of the shown cards */}
              <div className="grid grid-cols-5 gap-2 mb-6">
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
