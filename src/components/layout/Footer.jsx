import { Link } from 'react-router-dom';

const FOOTER_LINKS = [
  {
    title: 'Gioco',
    links: [
      { label: 'Inizia a Giocare', to: '/login' },
      { label: 'Carte', to: '/#cards' },
      { label: 'Classifiche', to: '/leaderboard' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Notizie', to: '/#news' },
      { label: 'Discord', to: '#' },
      { label: 'Forum', to: '#' },
    ],
  },
  {
    title: 'Supporto',
    links: [
      { label: 'FAQ', to: '#' },
      { label: 'Contattaci', to: '#' },
      { label: 'Segnala Bug', to: '#' },
    ],
  },
];

const SOCIAL_ICONS = [
  { name: 'Twitter', href: '#', icon: 'M22.46 6c-.85.38-1.78.64-2.73.76 1-.6 1.76-1.54 2.12-2.67-.93.55-1.96.95-3.06 1.17A4.78 4.78 0 0015.5 4c-2.65 0-4.8 2.15-4.8 4.8 0 .38.04.75.13 1.1A13.6 13.6 0 011.64 4.9a4.82 4.82 0 001.49 6.4 4.73 4.73 0 01-2.18-.6v.06c0 2.33 1.65 4.27 3.85 4.71a4.8 4.8 0 01-2.17.08 4.81 4.81 0 004.49 3.34A9.63 9.63 0 010 21.54a13.56 13.56 0 007.37 2.16c8.84 0 13.67-7.32 13.67-13.67 0-.21 0-.42-.02-.62A9.8 9.8 0 0024 6.56a9.6 9.6 0 01-2.54.7z' },
  { name: 'YouTube', href: '#', icon: 'M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 00.5 6.19 31.6 31.6 0 000 12a31.6 31.6 0 00.5 5.81 3.02 3.02 0 002.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 002.12-2.14A31.6 31.6 0 0024 12a31.6 31.6 0 00-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z' },
  { name: 'Discord', href: '#', icon: 'M20.32 4.37A19.8 19.8 0 0015.39 3c-.21.38-.46.88-.63 1.28a18.4 18.4 0 00-5.52 0A13 13 0 008.61 3a19.7 19.7 0 00-4.93 1.37C.53 9.95-.33 15.4.1 20.78A19.9 19.9 0 006.05 24a15 15 0 001.28-2.08 12.9 12.9 0 01-2.02-1 13 13 0 00.5-.38 14.2 14.2 0 0012.18 0c.16.13.33.26.5.38a12.9 12.9 0 01-2.02 1c.37.73.8 1.42 1.28 2.08a19.8 19.8 0 005.95-3.22c.51-6.31-.87-11.71-3.38-16.41zM8.02 17.35c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42 2.18 1.08 2.16 2.42c0 1.34-.96 2.42-2.16 2.42zm7.96 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42 2.18 1.08 2.16 2.42c0 1.34-.95 2.42-2.16 2.42z' },
];

export default function Footer() {
  return (
    <footer className="bg-fantasy-darker border-t border-fantasy-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* ── Colonna Brand ─────────────────────────── */}
          <div>
            <h3 className="text-gold-gradient font-display font-bold text-lg mb-4">
              Armor&nbsp;&amp;&nbsp;Weapons
            </h3>
            <p className="text-fantasy-silver text-sm leading-relaxed">
              Il gioco di carte collezionabili definitivo.
              Costruisci il tuo mazzo, sfida i tuoi avversari,
              conquista la classifica.
            </p>
            {/* Icone social */}
            <div className="flex gap-3 mt-5">
              {SOCIAL_ICONS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-fantasy-card border border-fantasy-border text-fantasy-silver hover:text-fantasy-gold hover:border-fantasy-gold/50 transition"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d={s.icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* ── Colonne Link ──────────────────────────── */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="text-white font-display font-semibold text-sm uppercase tracking-wider mb-4">
                {group.title}
              </h4>
              <ul className="space-y-2">
                {group.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-fantasy-silver text-sm hover:text-fantasy-gold transition"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Barra inferiore ──────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-fantasy-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-fantasy-silver text-xs">
            &copy; {new Date().getFullYear()} Armor &amp; Weapons. Tutti i diritti riservati.
          </p>
          <div className="flex gap-4 text-xs text-fantasy-silver">
            <Link to="#" className="hover:text-fantasy-gold transition">
              Termini e Condizioni
            </Link>
            <Link to="#" className="hover:text-fantasy-gold transition">
              Privacy Policy
            </Link>
            <Link to="#" className="hover:text-fantasy-gold transition">
              Cookie
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
