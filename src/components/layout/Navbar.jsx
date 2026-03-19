import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { countPendingPacks } from '../../services/packs';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Notizie', to: '/#news' },
  { label: 'Carte', to: '/#cards' },
  { label: 'Classifica', to: '/leaderboard' },
];

const AUTH_LINKS = [
  { label: 'Lobby', to: '/lobby' },
  { label: 'Collezione', to: '/collection' },
  { label: 'Deck Builder', to: '/deck-builder' },
  { label: 'Negozio', to: '/shop' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingPacks, setPendingPacks] = useState(0);
  const [packDropdown, setPackDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const location = useLocation();

  const links = user ? [...NAV_LINKS, ...AUTH_LINKS] : NAV_LINKS;

  // Load pending pack count
  useEffect(() => {
    if (!user) return;
    countPendingPacks(user.id).then(setPendingPacks);
  }, [user]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setPackDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-fantasy-darker/90 backdrop-blur-md border-b border-fantasy-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* ── Logo ─────────────────────────────────── */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-gold-gradient font-display font-bold text-xl sm:text-2xl tracking-wide">
            Armor&nbsp;&amp;&nbsp;Weapons
          </span>
        </Link>

        {/* ── Desktop Links ────────────────────────── */}
        <ul className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = location.pathname === l.to;
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${active
                      ? 'text-fantasy-gold bg-fantasy-gold/10'
                      : 'text-fantasy-silver hover:text-white hover:bg-white/5'
                    }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}

          {/* ── Pacchetti con badge e dropdown ──────── */}
          {user && (
            <li className="relative" ref={dropdownRef}>
              <button
                onMouseEnter={() => pendingPacks > 0 && setPackDropdown(true)}
                onClick={() => setPackDropdown(o => !o)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors relative
                  ${location.pathname === '/lobby' && pendingPacks > 0
                    ? 'text-fantasy-gold bg-fantasy-gold/10'
                    : 'text-fantasy-silver hover:text-white hover:bg-white/5'
                  }`}
              >
                Pacchetti
                {/* Red pulsing dot */}
                {pendingPacks > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                  </span>
                )}
              </button>

              {/* Dropdown notification */}
              {packDropdown && pendingPacks > 0 && (
                <div
                  className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-fantasy-gold/30 overflow-hidden shadow-2xl"
                  style={{ background: '#12121a' }}
                  onMouseLeave={() => setPackDropdown(false)}
                >
                  <div className="px-4 py-3 border-b border-fantasy-border">
                    <p className="text-fantasy-gold font-display font-bold text-xs">🎁 Pacchetti Regalo</p>
                  </div>
                  <Link
                    to="/lobby"
                    onClick={() => setPackDropdown(false)}
                    className="block px-4 py-3 hover:bg-white/5 transition"
                  >
                    <p className="text-white text-sm">
                      Hai <strong className="text-fantasy-gold">{pendingPacks}</strong>{' '}
                      {pendingPacks === 1 ? 'Pacchetto' : 'Pacchetti'} Regalo da riscattare!
                    </p>
                    <p className="text-fantasy-silver text-[10px] mt-1">Vai alla Lobby per sbustare →</p>
                  </Link>
                </div>
              )}
            </li>
          )}
        </ul>

        {/* ── CTA Desktop ──────────────────────────── */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link
              to="/lobby"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-sm tracking-wider hover:brightness-110 transition"
            >
              Lobby
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-sm tracking-wider hover:brightness-110 transition"
            >
              Gioca
            </Link>
          )}
        </div>

        {/* ── Mobile Hamburger ─────────────────────── */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden p-2 text-fantasy-silver hover:text-white"
          aria-label="Toggle menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* ── Mobile Menu ────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden bg-fantasy-dark border-t border-fantasy-border">
          <ul className="flex flex-col px-4 py-3 gap-1">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-md text-sm font-medium text-fantasy-silver hover:text-white hover:bg-white/5 transition"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {/* Mobile Pacchetti link */}
            {user && pendingPacks > 0 && (
              <li>
                <Link
                  to="/lobby"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-fantasy-gold hover:bg-fantasy-gold/10 transition"
                >
                  🎁 Pacchetti
                  <span className="flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                  </span>
                  <span className="text-[10px] text-fantasy-silver">({pendingPacks} da riscattare)</span>
                </Link>
              </li>
            )}
            <li className="mt-2">
              <Link
                to={user ? '/lobby' : '/login'}
                onClick={() => setMobileOpen(false)}
                className="block text-center px-5 py-2 rounded-lg bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-sm tracking-wider"
              >
                {user ? 'Lobby' : 'Gioca'}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
