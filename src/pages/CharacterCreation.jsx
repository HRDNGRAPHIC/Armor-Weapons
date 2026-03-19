import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { upsertProfile } from '../services/profiles';

const FACTIONS = [
  {
    id: 'cavalieri',
    name: 'I Cavalieri',
    color: 'fantasy-gold',
    icon: '⚔️',
    desc: 'Nobili difensori del regno, paladini della luce e della giustizia.',
    bonus: '+1 DEF base alle carte Cavaliere',
    gradient: 'from-fantasy-gold/20 to-yellow-900/10',
    border: 'border-fantasy-gold',
  },
  {
    id: 'non_morti',
    name: 'I Non Morti',
    color: 'fantasy-purple',
    icon: '💀',
    desc: 'Signori delle tenebre, negromanti e guerrieri caduti tornati dall\'oltretomba.',
    bonus: '+1 ATK base alle carte Cavaliere',
    gradient: 'from-fantasy-purple/20 to-purple-900/10',
    border: 'border-fantasy-purple',
  },
];

const GENDERS = [
  { id: 'male', label: 'Maschio', icon: '🛡️' },
  { id: 'female', label: 'Femmina', icon: '⚜️' },
];

export default function CharacterCreation() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [nickname, setNickname] = useState(profile?.username ?? '');
  const [gender, setGender] = useState('male');
  const [faction, setFaction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Se il personaggio è già stato creato, manda avanti
  if (profile?.onboarding_completed) {
    navigate(profile.subscription_tier ? '/lobby' : '/onboarding', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Il nickname deve avere almeno 2 caratteri.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Il nickname non può superare i 20 caratteri.');
      return;
    }
    if (!faction) {
      setError('Scegli una fazione per proseguire.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await upsertProfile(user.id, {
        username: trimmed,
        gender,
        faction,
        onboarding_completed: true,
      });
      refreshProfile();
      navigate('/onboarding', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-white mb-2">
              Crea il tuo <span className="text-gold-gradient">Personaggio</span>
            </h1>
            <p className="text-fantasy-silver text-sm">
              Scegli un nome, genere e fazione per entrare nell'arena.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-fantasy-red/10 border border-fantasy-red/30 text-fantasy-red text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ── Nickname ──────────────────────────── */}
            <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6">
              <label className="block font-display font-semibold text-white text-lg mb-3">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Il tuo nome nell'arena…"
                maxLength={20}
                className="w-full px-4 py-3 bg-fantasy-darker border border-fantasy-border rounded-xl text-white placeholder:text-fantasy-silver/50 focus:outline-none focus:border-fantasy-gold transition"
              />
              <p className="text-fantasy-silver text-xs mt-2">Min 2, max 20 caratteri</p>
            </div>

            {/* ── Genere ────────────────────────────── */}
            <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6">
              <h2 className="font-display font-semibold text-white text-lg mb-4">Genere</h2>
              <div className="grid grid-cols-2 gap-4">
                {GENDERS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGender(g.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 ${
                      gender === g.id
                        ? 'border-fantasy-gold bg-fantasy-gold/10 shadow-[0_0_20px_rgba(201,168,76,0.15)]'
                        : 'border-fantasy-border hover:border-fantasy-gold/40'
                    }`}
                  >
                    <span className="text-3xl">{g.icon}</span>
                    <span className={`font-display font-semibold text-sm ${gender === g.id ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                      {g.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Fazione ───────────────────────────── */}
            <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6">
              <h2 className="font-display font-semibold text-white text-lg mb-4">Fazione</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FACTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFaction(f.id)}
                    className={`text-left p-5 rounded-xl border-2 transition-all duration-300 bg-gradient-to-br ${f.gradient} ${
                      faction === f.id
                        ? `${f.border} shadow-[0_0_30px_rgba(201,168,76,0.12)]`
                        : 'border-fantasy-border hover:border-fantasy-gold/30'
                    }`}
                  >
                    <span className="text-4xl block mb-2">{f.icon}</span>
                    <h3 className={`font-display font-bold text-lg mb-1 ${
                      faction === f.id ? `text-${f.color}` : 'text-white'
                    }`}>
                      {f.name}
                    </h3>
                    <p className="text-fantasy-silver text-xs mb-2">{f.desc}</p>
                    <p className="text-fantasy-gold text-xs font-semibold">✦ {f.bonus}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Submit ────────────────────────────── */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-lg tracking-wider hover:brightness-110 hover:shadow-[0_0_50px_rgba(201,168,76,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creazione in corso…' : 'Entra nell\'Arena ⚔️'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
