import { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import PackOpening from '../components/PackOpening';

/* ══════════════════════════════════════════════════════════
 * ECONOMY — Based on modern CCG market research
 * Base value: 100 coins ≈ €1.00
 * ══════════════════════════════════════════════════════════ */

/* ── Row 1: Standard Packs (type-specific, 100 coins) ── */
const STANDARD_PACKS = [
  { id: 'std-knight', name: 'Pacchetto Cavalieri',  price: 100, icon: '⚔️', desc: '5 carte Cavaliere',          tier: 'standard', typeFilter: 'knight'  },
  { id: 'std-item',   name: 'Pacchetto Oggetti',    price: 100, icon: '🧪', desc: '5 carte Oggetto',            tier: 'standard', typeFilter: 'item'    },
  { id: 'std-shield', name: 'Pacchetto Scudi',      price: 100, icon: '🛡️', desc: '5 carte Scudo',             tier: 'standard', typeFilter: 'shield'  },
  { id: 'std-terrain',name: 'Pacchetto Terreni',    price: 100, icon: '🌍', desc: '5 carte Terreno',            tier: 'standard', typeFilter: 'terrain' },
  { id: 'std-weapon', name: 'Pacchetto Armi',       price: 100, icon: '🗡️', desc: '5 carte Arma',              tier: 'standard', typeFilter: 'weapon'  },
];

/* ── Row 2: Premium Packs (type-specific, 400 coins, no commons) ── */
const PREMIUM_PACKS = [
  { id: 'prm-knight', name: 'Cavalieri Premium',  price: 400, icon: '⚔️', desc: 'Signori della guerra nati nell\'oscurit\u00e0. Cinque cavalieri d\'alto lignaggio. Nessun comune, solo predatori.',      tier: 'premium', typeFilter: 'knight'  },
  { id: 'prm-item',   name: 'Oggetti Premium',    price: 400, icon: '🧪', desc: 'Reliquie rubate ai caduti. Cinque oggetti di potere oscuro. Solo il raro e il leggendario.',                              tier: 'premium', typeFilter: 'item'    },
  { id: 'prm-shield', name: 'Scudi Premium',      price: 400, icon: '🛡️', desc: 'Barriere forgiate nell\'acciaio maledetto. Cinque scudi implacabili. Il comune non ha accesso.',              tier: 'premium', typeFilter: 'shield'  },
  { id: 'prm-terrain',name: 'Terreni Premium',    price: 400, icon: '🌍', desc: 'Campi di battaglia dove gli dei sono caduti. Cinque terreni di alta rarit\u00e0. Il destino qui non \u00e8 casuale.', tier: 'premium', typeFilter: 'terrain' },
  { id: 'prm-weapon', name: 'Armi Premium',       price: 400, icon: '🗡️', desc: 'Forgiate nel fuoco oscuro. Cinque armi leggendarie o rare garantite. Nessuna banalit\u00e0.',                   tier: 'premium', typeFilter: 'weapon'  },
];

/* ── Row 3: Premium Mix + Real-money coin bundles ── */
const MIX_PACK = {
  id: 'prm-mix', name: 'Premium Mix', price: 500, icon: '👑',
  desc: 'Il bottino dei Re Caduti. Cinque carte assortite di altissimo rango. Solo per veri conquistatori.', tier: 'premium', typeFilter: null,
};

const COIN_BUNDLES = [
  { id: 'coins-1', name: 'Sacco di Monete',           price: '2,99€', coins: 300,  bonus: '+5%',   icon: '💰' },
  { id: 'coins-2', name: 'Forziere di Monete',        price: '4,99€', coins: 550,  bonus: '+10%',  icon: '📦' },
  { id: 'coins-3', name: 'Tesoro Reale',              price: '9,99€', coins: 1200, bonus: '+20%',  icon: '👑' },
  { id: 'coins-4', name: 'Tributo dell\'Imperatore',  price: '19,99€',coins: 2500, bonus: '+25%',  icon: '🏰' },
];

/* ── Animated separator component ─────────────────── */
function GoldSeparator({ label }) {
  return (
    <div className="relative flex items-center gap-4 my-10">
      <div className="flex-1 h-[1px] bg-fantasy-gold/50 overflow-hidden relative">
        <div className="shop-separator-glow" />
      </div>
      <span className="font-display font-bold text-fantasy-gold text-sm tracking-widest uppercase whitespace-nowrap px-2">
        {label}
      </span>
      <div className="flex-1 h-[1px] bg-fantasy-gold/50 overflow-hidden relative">
        <div className="shop-separator-glow-reverse" />
      </div>
    </div>
  );
}

/* ── Shop card component (UIverse-inspired) ──────── */
function ShopCard({ pack, canAfford, justBought, onBuy, isPremium }) {
  return (
    <div className="shop-card group cursor-pointer h-full">
      <div className="shop-card-inner">
        {/* Glow border effect */}
        <div className={`shop-card-glow ${isPremium ? 'shop-card-glow-premium' : ''}`} />
        <div className="shop-card-content">
          <span className="text-5xl block mb-3 drop-shadow-lg transition-transform duration-300 group-hover:scale-110">
            {pack.icon}
          </span>
          <h3 className="font-display font-semibold text-white text-sm mb-1 leading-tight">
            {pack.name}
          </h3>
          <p className="text-fantasy-silver text-[11px] mb-4 leading-snug flex-1">{pack.desc}</p>
          <button
            onClick={() => onBuy(pack)}
            disabled={!canAfford || justBought}
            className={`shop-buy-btn w-full py-2 rounded-lg border font-display font-bold text-xs transition-all duration-300 cursor-pointer ${
              justBought
                ? 'border-fantasy-green text-fantasy-green bg-fantasy-green/10'
                : canAfford
                  ? 'border-fantasy-gold/60 text-fantasy-gold hover:bg-fantasy-gold hover:text-fantasy-darker hover:border-fantasy-gold'
                  : 'border-fantasy-border text-fantasy-silver/40 cursor-not-allowed'
            }`}
          >
            {justBought ? '✓ Acquistato!' : `🪙 ${pack.price}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Coin bundle card component ──────────────────── */
function CoinCard({ bundle }) {
  return (
    <div className="shop-card group cursor-pointer h-full">
      <div className="shop-card-inner">
        <div className="shop-card-glow shop-card-glow-coin" />
        <div className="shop-card-content">
          <span className="text-5xl block mb-3 drop-shadow-lg transition-transform duration-300 group-hover:scale-110">
            {bundle.icon}
          </span>
          <h3 className="font-display font-semibold text-white text-sm mb-1 leading-tight">
            {bundle.name}
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
            <p className="text-fantasy-gold text-lg font-bold">🪙 {bundle.coins}</p>
            {bundle.bonus && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-fantasy-green/20 text-fantasy-green border border-fantasy-green/30">
                Sconto {bundle.bonus}
              </span>
            )}
          </div>
          <button
            className="shop-buy-btn w-full py-2 rounded-lg border border-fantasy-gold/60 text-fantasy-gold font-display font-bold text-xs transition-all duration-300 hover:bg-fantasy-gold hover:text-fantasy-darker hover:border-fantasy-gold cursor-pointer"
          >
            {bundle.price}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
 * MAIN SHOP COMPONENT
 * ══════════════════════════════════════════════════════════ */
export default function Shop() {
  const { user, gold, refreshProfile, updateUserGold } = useAuth();
  const [openingPack, setOpeningPack] = useState(null);
  const [purchased, setPurchased] = useState(null);

  async function handleBuy(pack) {
    if (gold < pack.price || !user) return;
    try {
      await updateUserGold(-pack.price);
      setPurchased(pack.id);
      setTimeout(() => {
        setPurchased(null);
        setOpeningPack({ tier: pack.tier, typeFilter: pack.typeFilter });
      }, 800);
    } catch (err) {
      console.error('Errore acquisto:', err);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-display font-bold text-3xl text-white">
              <span className="text-gold-gradient">Negozio</span>
            </h1>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-fantasy-card border border-fantasy-gold/30">
              <span className="text-lg">🪙</span>
              <span className="text-fantasy-gold font-display font-bold text-lg">{gold}</span>
            </div>
          </div>

          {/* ── ROW 1: Standard Packs ──────────────── */}
          <GoldSeparator label="Pacchetti Standard" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
            {STANDARD_PACKS.map(pack => (
              <ShopCard
                key={pack.id}
                pack={pack}
                canAfford={gold >= pack.price}
                justBought={purchased === pack.id}
                onBuy={handleBuy}
                isPremium={false}
              />
            ))}
          </div>

          {/* ── ROW 2: Premium Packs ───────────────── */}
          <GoldSeparator label="Pacchetti Premium" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
            {PREMIUM_PACKS.map(pack => (
              <ShopCard
                key={pack.id}
                pack={pack}
                canAfford={gold >= pack.price}
                justBought={purchased === pack.id}
                onBuy={handleBuy}
                isPremium={true}
              />
            ))}
          </div>

          {/* ── ROW 3: Mix + Coin Bundles ──────────── */}
          <GoldSeparator label="Premium Mix & Cambio Valuta" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 items-stretch">
            <ShopCard
              pack={MIX_PACK}
              canAfford={gold >= MIX_PACK.price}
              justBought={purchased === MIX_PACK.id}
              onBuy={handleBuy}
              isPremium={true}
            />
            {COIN_BUNDLES.map(bundle => (
              <CoinCard key={bundle.id} bundle={bundle} />
            ))}
          </div>
        </div>
      </div>

      {/* Pack Opening Overlay */}
      {openingPack && (
        <PackOpening
          packTier={openingPack.tier}
          typeFilter={openingPack.typeFilter}
          onClose={() => { setOpeningPack(null); refreshProfile(); }}
        />
      )}
    </div>
  );
}
