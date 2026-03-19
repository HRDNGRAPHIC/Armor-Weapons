import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-fantasy-darker flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-8xl mb-4">⚔️</p>
        <h1 className="font-display font-bold text-5xl text-white mb-4">404</h1>
        <p className="text-fantasy-silver text-lg mb-8">
          Questa zona della mappa non è ancora stata esplorata.
        </p>
        <Link
          to="/"
          className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-fantasy-gold to-fantasy-gold-light text-fantasy-darker font-display font-bold text-sm tracking-wider hover:brightness-110 transition"
        >
          Torna alla Home
        </Link>
      </div>
    </div>
  );
}
