import { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { upsertProfile } from '../services/profiles';
import { useNavigate } from 'react-router-dom';

const TIER_LABELS = { 'tier-1': 'Guerriero', 'tier-2': 'Campione', 'tier-3': 'Leggenda' };
const FACTION_LABELS = { cavalieri: '⚔️ I Cavalieri', non_morti: '💀 I Non Morti' };

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);

  const avatarUrl = user?.user_metadata?.avatar_url;

  async function handleLogout() {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error('[Profile] signOut error:', err);
    }
    // Force full page reload to wipe all in-memory state
    window.location.href = '/login';
  }

  async function handleSaveName() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length < 2 || !user) return;
    setSaving(true);
    try {
      await upsertProfile(user.id, { username: trimmed });
      refreshProfile();
      setEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-white mb-8">
            Il tuo <span className="text-gold-gradient">Profilo</span>
          </h1>

          <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-6 sm:p-8">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-fantasy-gold/30 to-fantasy-purple/30 border-2 border-fantasy-gold flex items-center justify-center text-5xl mb-4 overflow-hidden">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : '🛡️'
                }
              </div>
              {/* Editable name */}
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={20}
                    className="px-3 py-1.5 bg-fantasy-darker border border-fantasy-border rounded-lg text-white text-sm focus:outline-none focus:border-fantasy-gold"
                  />
                  <button onClick={handleSaveName} disabled={saving} className="text-fantasy-gold text-sm font-bold hover:underline">
                    {saving ? '…' : '✓'}
                  </button>
                  <button onClick={() => setEditingName(false)} className="text-fantasy-silver text-sm hover:text-white">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-xl text-white">
                    {profile?.username ?? user?.user_metadata?.full_name ?? 'Giocatore'}
                  </h2>
                  <button onClick={() => { setNewName(profile?.username ?? ''); setEditingName(true); }} className="text-fantasy-gold text-xs hover:underline">
                    ✏️
                  </button>
                </div>
              )}
              <p className="text-fantasy-silver text-sm">{user?.email}</p>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Fazione</span>
                <span className="text-white text-sm font-semibold">{FACTION_LABELS[profile?.faction] ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Genere</span>
                <span className="text-white text-sm">{profile?.gender === 'female' ? 'Femmina' : 'Maschio'}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Piano attivo</span>
                <span className="text-white text-sm font-semibold">{TIER_LABELS[profile?.subscription_tier] ?? 'Nessuno'}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Livello</span>
                <span className="text-white text-sm font-semibold">{profile?.level ?? 1}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">ELO</span>
                <span className="text-fantasy-purple-light text-sm font-semibold">{profile?.elo ?? 1000}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Monete</span>
                <span className="text-fantasy-gold text-sm font-semibold">🪙 {profile?.coins ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Vittorie / Sconfitte</span>
                <span className="text-white text-sm font-semibold">{profile?.wins ?? 0} / {profile?.losses ?? 0}</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full mt-8 py-3 rounded-xl border border-fantasy-red text-fantasy-red font-display font-bold text-sm hover:bg-fantasy-red/10 transition"
            >
              Esci
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
