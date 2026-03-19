import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { upsertProfile } from '../services/profiles';

const PLANS = [
  {
    id: 'tier-1',
    name: 'Guerriero',
    price: '4,99',
    period: '/mese',
    features: [
      'Accesso completo al gioco',
      '1 pacchetto carte rare / mese',
      'Accesso alla mappa globale',
      'Matchmaking standard',
    ],
    highlighted: false,
  },
  {
    id: 'tier-2',
    name: 'Campione',
    price: '8,99',
    period: '/mese',
    features: [
      'Accesso completo al gioco',
      '2 pacchetti carte rare / mese',
      'Accesso alla mappa globale',
      'Matchmaking prioritario',
      'Badge esclusivo',
    ],
    highlighted: true,
  },
  {
    id: 'tier-3',
    name: 'Leggenda',
    price: '12,99',
    period: '/mese',
    features: [
      'Accesso completo al gioco',
      '2 pacchetti carte premium / mese',
      'Accesso alla mappa globale',
      'Matchmaking prioritario',
      'Badge leggendario + Avatar esclusivo',
      'Accesso anticipato nuove espansioni',
    ],
    highlighted: false,
  },
];

const TIER_COINS_BONUS = { 'tier-1': 500, 'tier-2': 1000, 'tier-3': 2000 };

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Se l'utente ha già un abbonamento attivo, vai direttamente alla Lobby
  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate('/character-creation', { replace: true });
    } else if (profile?.subscription_tier) {
      navigate('/lobby', { replace: true });
    }
  }, [profile, navigate]);

  async function handleSelectPlan(planId) {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // TODO: chiamare Stripe Checkout qui prima di salvare il tier
      await upsertProfile(user.id, {
        subscription_tier: planId,
        subscription_expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        coins: TIER_COINS_BONUS[planId] ?? 500,
      });
      refreshProfile();
      navigate('/lobby', { replace: true });
    } catch (err) {
      setError('Errore durante la selezione del piano. Riprova.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14">
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Scegli il tuo <span className="text-gold-gradient">Piano</span>
            </h1>
            <p className="text-fantasy-silver max-w-xl mx-auto">
              Seleziona un abbonamento mensile per sbloccare tutto il potenziale dell'arena.
            </p>
          </div>

          {error && (
            <p className="text-center text-fantasy-red text-sm mb-6">{error}</p>
          )}

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-fantasy-card rounded-2xl p-6 sm:p-8 border transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlighted
                    ? 'border-fantasy-gold shadow-[0_0_40px_rgba(201,168,76,0.15)]'
                    : 'border-fantasy-border hover:border-fantasy-gold/40'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker text-xs font-bold uppercase tracking-wider">
                    Più Popolare
                  </div>
                )}

                <h3 className="font-display font-bold text-white text-xl mb-1">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-gold-gradient font-display font-black text-4xl">
                    €{plan.price}
                  </span>
                  <span className="text-fantasy-silver text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-fantasy-silver">
                      <span className="text-fantasy-gold mt-0.5">✦</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={saving}
                  className={`w-full py-3 rounded-xl font-display font-bold text-sm tracking-wider transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker hover:brightness-110'
                      : 'border border-fantasy-border text-fantasy-silver hover:text-white hover:border-fantasy-gold/50'
                  }`}
                >
                  {saving ? 'Attendi…' : `Scegli ${plan.name}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
