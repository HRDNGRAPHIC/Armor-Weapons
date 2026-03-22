import { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import PackOpening from '../components/PackOpening';

const PACKS = [
  {
    id: 'cavalieri',
    name: 'Pacchetto Cavalieri',
    price: 500,
    icon: '⚔️',
    desc: '5 carte casuali di tipo Cavaliere',
    packType: 'standard',
  },
  {
    id: 'scudi',
    name: 'Pacchetto Scudi',
    price: 150,
    icon: '🛡️',
    desc: '5 carte casuali di tipo Scudo',
    packType: 'standard',
  },
  {
    id: 'terreni',
    name: 'Pacchetto Terreni',
    price: 400,
    icon: '🏔️',
    desc: '5 carte casuali di tipo Terreno',
    packType: 'standard',
  },
  {
    id: 'armi',
    name: 'Pacchetto Armi',
    price: 600,
    icon: '🗡️',
    desc: '5 carte casuali di tipo Arma',
    packType: 'standard',
  },
  {
    id: 'premium',
    name: 'Pacchetto Premium',
    price: 1200,
    icon: '👑',
    desc: '5 carte con almeno 1 garantita Epica+',
    packType: 'premium',
  },
];

export default function Shop() {
  const { user, gold, refreshProfile, updateUserGold } = useAuth();
  const [openingPack, setOpeningPack] = useState(null);
  const [purchased, setPurchased] = useState(null); // pack id of just-purchased

  async function handleBuy(pack) {
    if (gold < pack.price || !user) return;
    try {
      await updateUserGold(-pack.price);
      // Brief feedback before opening
      setPurchased(pack.id);
      setTimeout(() => {
        setPurchased(null);
        setOpeningPack(pack.packType);
      }, 800);
    } catch (err) {
      console.error('Errore acquisto:', err);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-display font-bold text-3xl text-white">
              <span className="text-gold-gradient">Negozio</span>
            </h1>
            <div className="text-fantasy-gold font-bold">🪙 {gold}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {PACKS.map((pack) => {
              const canAfford = gold >= pack.price;
              const justBought = purchased === pack.id;
              return (
                <div
                  key={pack.id}
                  className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6 text-center hover:border-fantasy-gold/40 hover:-translate-y-1 transition-all duration-300 flex flex-col"
                >
                  <span className="text-6xl block mb-4">{pack.icon}</span>
                  <h3 className="font-display font-semibold text-white text-lg mb-1">
                    {pack.name}
                  </h3>
                  <p className="text-fantasy-silver text-sm mb-4">{pack.desc}</p>
                  <button
                    onClick={() => handleBuy(pack)}
                    disabled={!canAfford || justBought}
                    className={`w-full py-2.5 rounded-xl border font-display font-bold text-sm transition mt-auto ${
                      justBought
                        ? 'border-fantasy-green text-fantasy-green bg-fantasy-green/10'
                        : canAfford
                          ? 'border-fantasy-gold text-fantasy-gold hover:bg-fantasy-gold/10'
                          : 'border-fantasy-border text-fantasy-silver/40 cursor-not-allowed'
                    }`}
                  >
                    {justBought ? '✓ Acquistato!' : `🪙 ${pack.price}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pack Opening Overlay */}
      {openingPack && (
        <PackOpening
          packType={openingPack}
          onClose={() => { setOpeningPack(null); refreshProfile(); }}
        />
      )}
    </div>
  );
}
