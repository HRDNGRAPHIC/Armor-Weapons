import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import { getLeaderboard } from '../services/elo';
import { useAuth } from '../context/AuthContext';

export default function Leaderboard() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getLeaderboard(50);
      if (!cancelled) {
        setPlayers(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display font-bold text-3xl text-white mb-8">
            Classifica <span className="text-gold-gradient">Globale</span>
          </h1>

          {loading ? (
            <div className="text-center text-fantasy-silver py-16 text-lg animate-pulse">Caricamento classifica...</div>
          ) : players.length === 0 ? (
            <div className="text-center text-fantasy-silver py-16 text-lg">Nessun giocatore in classifica.</div>
          ) : (
            <div className="bg-fantasy-card border border-fantasy-border rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 px-4 sm:px-6 py-3 bg-fantasy-dark text-fantasy-silver text-xs font-semibold uppercase tracking-wider">
                <div>#</div>
                <div className="col-span-2">Giocatore</div>
                <div className="text-center">Elo</div>
                <div className="text-center">Vittorie</div>
                <div className="text-center">Livello</div>
              </div>

              {/* Rows */}
              {players.map((player, i) => {
                const rank = i + 1;
                const isMe = user && player.id === user.id;
                return (
                  <div
                    key={player.id}
                    className={`grid grid-cols-6 gap-2 px-4 sm:px-6 py-3 border-t border-fantasy-border/50 text-sm ${
                      rank <= 3 ? 'bg-fantasy-gold/5' : ''
                    } ${isMe ? 'ring-1 ring-fantasy-gold/40 bg-fantasy-gold/10' : ''}`}
                  >
                    <div className={`font-bold ${rank <= 3 ? 'text-fantasy-gold' : 'text-fantasy-silver'}`}>
                      {rank <= 3 ? ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][rank - 1] : rank}
                    </div>
                    <div className="col-span-2 text-white font-medium truncate">
                      {player.display_name || player.username || 'Anonimo'}
                      {isMe && <span className="ml-2 text-xs text-fantasy-gold">(Tu)</span>}
                    </div>
                    <div className="text-center text-fantasy-gold font-semibold">
                      {player.elo ?? 100}
                    </div>
                    <div className="text-center text-green-400">
                      {player.wins ?? 0}
                    </div>
                    <div className="text-center text-fantasy-silver">
                      Lv. {player.level ?? 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
