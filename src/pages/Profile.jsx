import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { upsertProfile } from '../services/profiles';
import { useNavigate } from 'react-router-dom';

const TIER_LABELS = { 'tier-1': 'Guerriero', 'tier-2': 'Campione', 'tier-3': 'Leggenda' };
const FACTION_LABELS = { cavalieri: '⚔️ I Cavalieri', non_morti: '💀 I Non Morti' };

export default function Profile() {
  const { user, profile, gold, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      // Call RPC to delete user from auth.users (cascades all data)
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      // Sign out and redirect
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/login';
    } catch (err) {
      console.error('[Profile] deleteAccount error:', err);
      setDeleting(false);
      setShowDeletePopup(false);
    }
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
                <span className="text-fantasy-purple-light text-sm font-semibold">{profile?.elo ?? 100}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-fantasy-border/50">
                <span className="text-fantasy-silver text-sm">Monete</span>
                <span className="text-fantasy-gold text-sm font-semibold">🪙 {gold}</span>
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

            {/* Delete Account */}
            <button
              onClick={() => setShowDeletePopup(true)}
              className="w-full mt-3 py-3 rounded-xl border border-red-800/50 text-red-500/70 font-display font-bold text-xs hover:bg-red-900/10 hover:text-red-400 transition"
            >
              Elimina Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Popup */}
      <AnimatePresence>
        {showDeletePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => !deleting && setShowDeletePopup(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-fantasy-card border-2 border-red-900/60 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_60px_rgba(160,0,0,0.3)]"
            >
              <span className="text-5xl block mb-4">💀</span>
              <h2 className="font-display font-bold text-2xl text-red-500 mb-3">
                Eliminare Account?
              </h2>
              <p className="text-fantasy-silver text-sm mb-6 leading-relaxed">
                Questa azione è <strong className="text-red-400">irreversibile</strong>. Tutte le tue carte,
                mazzi, progressi e dati verranno eliminati per sempre.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeletePopup(false)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl border border-fantasy-border text-fantasy-silver font-display font-bold text-sm hover:bg-white/5 transition disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl bg-red-800 text-white font-display font-bold text-sm hover:bg-red-700 transition disabled:opacity-50"
                >
                  {deleting ? 'Eliminazione…' : 'Elimina per sempre'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
