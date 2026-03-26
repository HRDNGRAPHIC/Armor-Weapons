import { useNavigate } from 'react-router-dom';
import { signInWithGoogle } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Se già loggato, redirect
  useEffect(() => {
    if (user) navigate('/onboarding', { replace: true });
  }, [user, navigate]);

  async function handleGoogleLogin() {
    if (!supabase) {
      setError('Supabase non configurato: controlla il file .env');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // La pagina viene reindirizzata da Supabase — il codice sotto non verrà eseguito
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message ?? 'Errore durante il login. Riprova.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-fantasy-darker flex items-center justify-center px-4">
      {/* Ambient background — pointer-events-none per non bloccare i click */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_rgba(201,168,76,0.06)_0%,_transparent_60%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-fantasy-card border border-fantasy-border rounded-2xl p-8 sm:p-10 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-gold-gradient font-display font-bold text-3xl mb-2">
              Armor&nbsp;&amp;&nbsp;Weapons
            </h1>
            <p className="text-fantasy-silver text-sm">
              Accedi per iniziare la tua avventura
            </p>
          </div>

          {/* Messaggio errore */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {/* Pulsante Login con Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Reindirizzamento…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Accedi con Google
              </>
            )}
          </button>

          {/* Disclaimer */}
          <p className="text-fantasy-silver text-xs text-center mt-6 leading-relaxed">
            Accedendo, accetti i nostri{' '}
            <a href="#" className="text-fantasy-gold hover:underline">
              Termini di Servizio
            </a>{' '}
            e la{' '}
            <a href="#" className="text-fantasy-gold hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
