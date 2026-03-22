import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import PackOpening from '../components/PackOpening';
import ChestOpening from '../components/ChestOpening';
import { useAuth } from '../context/AuthContext';
import { getPendingPacks } from '../services/packs';
import { hasClaimedStarter } from '../services/starterChest';
import { playMedievalSound } from '../game/data/medievalAudio';

const LEVEL_RANKS = [
  { min: 1,  max: 9,  label: 'Apprendista' },
  { min: 10, max: 19, label: 'Guerriero' },
  { min: 20, max: 29, label: "Cavaliere d'Argento" },
  { min: 30, max: 49, label: "Cavaliere d'Oro" },
  { min: 50, max: 99, label: 'Campione' },
  { min: 100,max: Infinity, label: 'Leggenda' },
];

function getRank(level = 1) {
  return LEVEL_RANKS.find((r) => level >= r.min && level <= r.max)?.label ?? 'Apprendista';
}

const QUICK_ACTIONS = [
  { label: 'Collezione', to: '/collection', icon: '🃏', desc: 'Sfoglia le tue carte' },
  { label: 'Deck Builder', to: '/deck-builder', icon: '📦', desc: 'Costruisci un mazzo' },
  { label: 'Negozio', to: '/shop', icon: '🛒', desc: 'Acquista pacchetti' },
  { label: 'Classifica', to: '/leaderboard', icon: '🏆', desc: 'Ranking globale' },
  { label: 'Profilo', to: '/profile', icon: '⚙️', desc: 'Impostazioni' },
];

/* ── Stemma Araldico (Heraldic Badge) ──────────────── */
function HeraldicBadge({ tier }) {
  if (!tier) return null;

  const badges = {
    'tier-1': {
      // Ferro battuto
      base: '#6b6b6b', accent: '#8a8a8a', shine: '#b0b0b0',
      inner: '#4a4a4a', label: 'I',
    },
    'tier-2': {
      // Argento antico
      base: '#a8a8b8', accent: '#c0c0d0', shine: '#e0e0f0',
      inner: '#8a8a9a', label: 'II',
    },
    'tier-3': {
      // Oro brunito
      base: '#c9a84c', accent: '#e4c96a', shine: '#ffd700',
      inner: '#a08030', label: 'III',
    },
  };

  const b = badges[tier];
  if (!b) return null;

  return (
    <div className="absolute -top-1 -right-1 z-10" title={`Tier ${b.label}`}>
      <svg width="28" height="32" viewBox="0 0 28 32">
        {/* Shield shape */}
        <path
          d="M14 1 L26 5 L26 16 Q26 26 14 31 Q2 26 2 16 L2 5 Z"
          fill={b.base}
          stroke={b.accent}
          strokeWidth="1.5"
        />
        {/* Inner plate */}
        <path
          d="M14 4 L23 7 L23 15 Q23 23 14 27 Q5 23 5 15 L5 7 Z"
          fill={b.inner}
          stroke={b.accent}
          strokeWidth="0.5"
        />
        {/* Shine highlight */}
        <path
          d="M8 7 L14 5 L14 14 L8 12 Z"
          fill={b.shine}
          opacity="0.15"
        />
        {/* Tier number */}
        <text
          x="14" y="18"
          textAnchor="middle"
          fill={b.shine}
          fontSize="8"
          fontFamily="Cinzel, serif"
          fontWeight="bold"
        >
          {b.label}
        </text>
      </svg>
    </div>
  );
}

export default function Lobby() {
  const { user, profile, gold, refreshProfile } = useAuth();
  const [pendingPacks, setPendingPacks] = useState([]);
  const [openingPack, setOpeningPack] = useState(null);
  const [showStarterChest, setShowStarterChest] = useState(false);

  const level   = profile?.level  ?? 1;
  const wins    = profile?.wins   ?? 0;
  const losses  = profile?.losses ?? 0;
  const elo     = profile?.elo    ?? 100;
  const rank    = getRank(level);
  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = profile?.username
    ?? user?.user_metadata?.full_name
    ?? 'Giocatore';
  const tier = profile?.subscription_tier;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  // Load pending packs
  useEffect(() => {
    if (!user) return;
    getPendingPacks(user.id).then(setPendingPacks);
  }, [user]);

  // Check if starter chest needs to be shown
  useEffect(() => {
    if (!user) return;
    hasClaimedStarter(user.id).then(claimed => {
      if (!claimed) setShowStarterChest(true);
    });
  }, [user]);

  const handleStarterChestClosed = useCallback(() => {
    setShowStarterChest(false);
    if (refreshProfile) refreshProfile();
  }, [refreshProfile]);

  const handleOpenPack = useCallback((pack) => {
    playMedievalSound('parchment');
    setOpeningPack(pack);
  }, []);

  const handlePackClosed = useCallback(() => {
    setOpeningPack(null);
    // Refresh packs list
    if (user) getPendingPacks(user.id).then(setPendingPacks);
  }, [user]);

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* ── Player Info (compact, no paperdoll) ── */}
          <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar with heraldic badge */}
              <div className="relative shrink-0">
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-fantasy-gold/30 to-fantasy-purple/30 flex items-center justify-center text-4xl overflow-hidden ${
                  tier === 'tier-3' ? 'border-3 border-fantasy-purple-light shadow-[0_0_20px_rgba(107,63,160,0.4)]'
                  : tier === 'tier-2' ? 'border-3 border-fantasy-gold shadow-[0_0_20px_rgba(201,168,76,0.3)]'
                  : 'border-2 border-fantasy-border'
                }`}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    : '🛡️'
                  }
                </div>
                <HeraldicBadge tier={tier} />
              </div>

              <div className="flex-1 text-center sm:text-left">
                <h1 className="font-display font-bold text-2xl text-white mb-1">{displayName}</h1>
                <p className="text-fantasy-gold text-sm font-semibold mb-1">
                  {rank} — Livello {level}
                </p>
                {profile?.faction && (
                  <p className="text-fantasy-silver text-xs mb-3">
                    {profile.faction === 'cavalieri' ? '⚔️ I Cavalieri' : '💀 I Non Morti'}
                  </p>
                )}
                {/* Stats row */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-5 text-sm">
                  <div>
                    <span className="text-fantasy-silver text-xs">Vittorie</span>
                    <p className="text-fantasy-green font-bold text-lg">{wins}</p>
                  </div>
                  <div>
                    <span className="text-fantasy-silver text-xs">Sconfitte</span>
                    <p className="text-fantasy-red font-bold text-lg">{losses}</p>
                  </div>
                  <div>
                    <span className="text-fantasy-silver text-xs">Win Rate</span>
                    <p className="text-white font-bold text-lg">{winRate}%</p>
                  </div>
                  <div>
                    <span className="text-fantasy-silver text-xs">ELO</span>
                    <p className="text-fantasy-purple-light font-bold text-lg">{elo}</p>
                  </div>
                  <div>
                    <span className="text-fantasy-silver text-xs">Monete</span>
                    <p className="text-fantasy-gold font-bold text-lg">🪙 {gold}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Pending Packs (if any) ─────────────── */}
          {pendingPacks.length > 0 && (
            <div className="bg-gradient-to-r from-fantasy-gold/5 to-fantasy-purple/5 border border-fantasy-gold/30 rounded-2xl p-5 mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎁</span>
                <h2 className="font-display font-bold text-white text-lg">
                  Pacchetti da Riscattare
                </h2>
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                {pendingPacks.map(pack => (
                  <button
                    key={pack.id}
                    onClick={() => handleOpenPack(pack)}
                    className="group bg-fantasy-card border border-fantasy-gold/40 rounded-xl p-4 text-center hover:border-fantasy-gold hover:-translate-y-1 transition-all duration-300 w-36"
                  >
                    <span className="text-4xl block mb-2">🃏</span>
                    <p className="font-display font-semibold text-fantasy-gold text-xs">
                      {pack.pack_type === 'premium' ? 'Pack Premium' : 'Pack Standard'}
                    </p>
                    <p className="text-fantasy-silver text-[10px] mt-1 group-hover:text-white transition">
                      Tocca per sbustare
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Quick Actions Grid ─────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group bg-fantasy-card border border-fantasy-border rounded-2xl p-5 text-center hover:border-fantasy-gold/40 hover:-translate-y-1 transition-all duration-300"
              >
                <span className="text-4xl block mb-3">{action.icon}</span>
                <h3 className="font-display font-semibold text-white text-sm group-hover:text-fantasy-gold transition">
                  {action.label}
                </h3>
                <p className="text-fantasy-silver text-xs mt-1">{action.desc}</p>
              </Link>
            ))}
          </div>

          {/* ── Play Buttons ────────────────────────── */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              to="/play"
              state={{ mode: 'pve' }}
              className="inline-block px-14 py-4 rounded-xl bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-xl tracking-wider hover:brightness-110 hover:shadow-[0_0_50px_rgba(201,168,76,0.3)] transition-all duration-300"
            >
              ⚔️ Gioca contro il Computer
            </Link>
            <button
              disabled
              className="inline-block px-14 py-4 rounded-xl border border-fantasy-border text-fantasy-silver font-display font-bold text-lg tracking-wider opacity-50 cursor-not-allowed"
              title="Presto disponibile"
            >
              🛡️ Gioca contro Giocatori
            </button>
            <p className="text-fantasy-silver text-xs">Il PvP online sarà disponibile prossimamente</p>
          </div>
        </div>
      </div>

      {/* ── Pack Opening Overlay ─────────────────── */}
      <AnimatePresence>
        {openingPack && (
          <PackOpening
            packType={openingPack.pack_type ?? 'standard'}
            packId={openingPack.id}
            onClose={handlePackClosed}
            onCardsAdded={() => {}}
          />
        )}
      </AnimatePresence>

      {/* ── Starter Chest Overlay ─────────────────── */}
      <AnimatePresence>
        {showStarterChest && (
          <ChestOpening
            onClose={handleStarterChestClosed}
            onCardsAdded={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

