import React from 'react';

interface State { hasError: boolean; }

/**
 * Catches render/chunk-load errors (e.g. a lazy import that failed on a flaky
 * connection) and shows a friendly reload prompt instead of a blank or
 * perpetually-spinning screen.
 */
export class ChunkErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('App error boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          textAlign: 'center', padding: '2rem', color: 'var(--color-on-surface-variant)',
        }}>
          <h2 style={{ color: 'var(--color-on-background)' }}>Something went wrong loading this page</h2>
          <p>Please check your connection and try again.</p>
          <button
            onClick={() => { sessionStorage.removeItem('lz_chunk_reloaded'); window.location.reload(); }}
            style={{
              padding: '0.7rem 1.5rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
              background: 'var(--color-primary)', color: 'var(--color-on-primary)',
              fontSize: '1rem', fontWeight: 600,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
