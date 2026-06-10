'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h2 style={{ color: '#f87171' }}>Sayfa Hatası</h2>
      <pre style={{ background: '#1a1b24', padding: '1rem', borderRadius: '8px', color: '#fca5a5', fontSize: '11px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
        <b>Hata:</b> {error?.message}{'\n\n'}
        <b>Stack:</b>{'\n'}{error?.stack}
      </pre>
      <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#5e6ad2', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
        Tekrar Dene
      </button>
    </div>
  );
}
