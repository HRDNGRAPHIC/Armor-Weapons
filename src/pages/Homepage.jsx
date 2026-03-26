import { Link } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

/* ═══════════════════════════════════════════════════════
   HOMEPAGE — Landing Page in stile Blizzard / WotC
   ═══════════════════════════════════════════════════════ */

// Dati placeholder per le sezioni
const LATEST_NEWS = [
  {
    id: 1,
    title: 'Nuova Espansione: Il Crepuscolo dei Re',
    excerpt: 'Oltre 120 nuove carte per ridefinire il meta...',
    date: '15 Mar 2026',
    tag: 'Espansione',
  },
  {
    id: 2,
    title: 'Torneo Stagionale — Primavera 2026',
    excerpt: 'Iscriviti al torneo più grande dell\'anno...',
    date: '10 Mar 2026',
    tag: 'Evento',
  },
  {
    id: 3,
    title: 'Bilanciamento Carte: Patch 2.4',
    excerpt: 'Aggiornamenti su cavalieri, terreni e armi...',
    date: '05 Mar 2026',
    tag: 'Patch',
  },
];

const FEATURED_CARDS = [
  { id: 1, name: 'Drago Ancestrale', rarity: 'Leggendaria', type: 'Creatura' },
  { id: 2, name: 'Spada del Valoroso', rarity: 'Epica', type: 'Arma' },
  { id: 3, name: 'Scudo Runico', rarity: 'Rara', type: 'Armatura' },
  { id: 4, name: 'Foresta Incantata', rarity: 'Epica', type: 'Terreno' },
];

const PLATFORMS = [
  { name: 'PC / Mac', icon: '🖥️', desc: 'Versione desktop completa' },
  { name: 'Mobile', icon: '📱', desc: 'iOS & Android (prossimamente)' },
  { name: 'Web', icon: '🌐', desc: 'Gioca direttamente dal browser' },
];

const RARITY_COLORS = {
  Leggendaria: 'text-fantasy-gold',
  Epica: 'text-fantasy-purple-light',
  Rara: 'text-fantasy-blue',
  Comune: 'text-fantasy-silver',
};

export default function Homepage() {
  return (
    <div className="min-h-screen bg-fantasy-darker">
      <Navbar />

      {/* ══════════════════════════════════════════════
          SEZIONE HERO
          ══════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Sfondo sovrapposto */}
        <div className="absolute inset-0 bg-gradient-to-b from-fantasy-darker via-fantasy-dark/80 to-fantasy-darker" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,168,76,0.08)_0%,_transparent_70%)]" />

        {/* Particelle decorative */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-fantasy-gold/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fantasy-purple/5 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 max-w-5xl mx-auto text-center px-4 sm:px-6">
          {/* Slogan */}
          <p className="text-fantasy-gold font-display text-sm sm:text-base uppercase tracking-[0.3em] mb-4 animate-fade-in">
            Gioco di carte strategico 
          </p>

          {/* Titolo principale */}
          <h1 className="font-display font-black text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-tight mb-6">
            <span className="text-gold-gradient">Armor</span>
            <span className="text-white">&nbsp;&amp;&nbsp;</span>
            <span className="text-gold-gradient">Weapons</span>
          </h1>

          {/* Sottotitolo */}
          <p className="text-fantasy-silver text-lg sm:text-xl md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Costruisci il mazzo perfetto. Scatena il potere delle carte leggendarie.
            Sfida i campioni di tutto il mondo.
          </p>

          {/* Pulsanti azione */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="group relative px-10 py-4 rounded-xl bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-lg tracking-wider hover:brightness-110 hover:shadow-[0_0_40px_rgba(201,168,76,0.3)] transition-all duration-300"
            >
              <span className="relative z-10">⚔️ Gioca Ora</span>
            </Link>
            <a
              href="#news"
              className="px-8 py-4 rounded-xl border border-fantasy-border text-fantasy-silver font-display font-semibold text-lg hover:text-white hover:border-fantasy-gold/50 transition-all duration-300"
            >
              Scopri di più
            </a>
          </div>

          {/* Barra statistiche */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { value: '500+', label: 'Carte' },
              { value: '50K+', label: 'Giocatori' },
              { value: '∞', label: 'Strategie' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-fantasy-gold font-display font-bold text-2xl sm:text-3xl">
                  {s.value}
                </p>
                <p className="text-fantasy-silver text-xs sm:text-sm mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Suggerimento scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg
            className="w-6 h-6 text-fantasy-gold/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          ULTIME NOTIZIE
          ══════════════════════════════════════════════ */}
      <section id="news" className="py-20 sm:py-28 bg-fantasy-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Ultime <span className="text-gold-gradient">Notizie</span>
            </h2>
            <p className="text-fantasy-silver max-w-xl mx-auto">
              Resta aggiornato su espansioni, tornei e aggiornamenti di bilanciamento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {LATEST_NEWS.map((news) => (
              <article
                key={news.id}
                className="group bg-fantasy-card border border-fantasy-border rounded-2xl overflow-hidden hover:border-fantasy-gold/40 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Area immagine segnaposto */}
                <div className="h-44 bg-gradient-to-br from-fantasy-purple/20 to-fantasy-dark flex items-center justify-center">
                  <span className="text-5xl opacity-40">🗞️</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-fantasy-gold/10 text-fantasy-gold border border-fantasy-gold/20">
                      {news.tag}
                    </span>
                    <span className="text-xs text-fantasy-silver">{news.date}</span>
                  </div>
                  <h3 className="font-display font-semibold text-white text-lg mb-2 group-hover:text-fantasy-gold transition">
                    {news.title}
                  </h3>
                  <p className="text-fantasy-silver text-sm leading-relaxed">
                    {news.excerpt}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          VETRINA CARTE
          ══════════════════════════════════════════════ */}
      <section id="cards" className="py-20 sm:py-28 bg-fantasy-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Carte in <span className="text-gold-gradient">Evidenza</span>
            </h2>
            <p className="text-fantasy-silver max-w-xl mx-auto">
              Scopri le ultime carte aggiunte alla collezione.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {FEATURED_CARDS.map((card) => (
              <div
                key={card.id}
                className="group relative bg-fantasy-card border border-fantasy-border rounded-2xl overflow-hidden hover:border-fantasy-gold/40 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(201,168,76,0.1)]"
              >
                {/* Segnaposto artwork carta */}
                <div className="aspect-[3/4] bg-gradient-to-br from-fantasy-purple/20 via-fantasy-dark to-fantasy-card flex items-center justify-center">
                  <span className="text-6xl opacity-30">🃏</span>
                </div>
                <div className="p-3 sm:p-4">
                  <h4 className="font-display font-semibold text-white text-sm sm:text-base group-hover:text-fantasy-gold transition">
                    {card.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs font-semibold ${RARITY_COLORS[card.rarity]}`}>
                      {card.rarity}
                    </span>
                    <span className="text-xs text-fantasy-silver">{card.type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PIATTAFORME
          ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-fantasy-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white mb-3">
              Gioca <span className="text-gold-gradient">Ovunque</span>
            </h2>
            <p className="text-fantasy-silver max-w-xl mx-auto">
              Armor &amp; Weapons è disponibile su tutte le piattaforme principali.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="text-center bg-fantasy-card border border-fantasy-border rounded-2xl p-8 hover:border-fantasy-gold/40 transition-all duration-300"
              >
                <span className="text-5xl">{p.icon}</span>
                <h3 className="font-display font-semibold text-white text-lg mt-4 mb-2">
                  {p.name}
                </h3>
                <p className="text-fantasy-silver text-sm">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CTA FINALE
          ══════════════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-fantasy-darker relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,168,76,0.06)_0%,_transparent_60%)]" />
        <div className="relative z-10 max-w-3xl mx-auto text-center px-4 sm:px-6">
          <h2 className="font-display font-bold text-3xl sm:text-5xl text-white mb-6">
            Pronto a entrare <span className="text-gold-gradient">nell&apos;Arena</span>?
          </h2>
          <p className="text-fantasy-silver text-lg mb-10 max-w-xl mx-auto">
            Unisciti a migliaia di giocatori e inizia la tua avventura oggi stesso.
          </p>
          <Link
            to="/login"
            className="inline-block px-12 py-4 rounded-xl bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-lg tracking-wider hover:brightness-110 hover:shadow-[0_0_40px_rgba(201,168,76,0.3)] transition-all duration-300"
          >
            ⚔️ Gioca Ora — È Gratis
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
