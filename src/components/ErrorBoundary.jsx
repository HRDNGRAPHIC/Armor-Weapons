import { Component } from 'react';

/**
 * Intercetta qualsiasi crash di rendering e mostra una schermata di recupero invece di una pagina vuota.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#060609',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          fontFamily: 'Inter, sans-serif',
        }}>
          <p style={{ color: '#8a0303', fontSize: '1.5rem', fontWeight: 700 }}>
            ⚔ Qualcosa è andato storto
          </p>
          <p style={{ color: '#8a8a9a', fontSize: '0.875rem', maxWidth: 480, textAlign: 'center' }}>
            {this.state.error?.message || 'Errore sconosciuto'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.5rem',
              background: '#c9a84c',
              color: '#060609',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ricarica
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
