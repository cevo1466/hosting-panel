'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body style={{ background: '#010103', color: '#fff', fontFamily: 'monospace', padding: '2rem' }}>
        <h2 style={{ color: '#f87171' }}>Uygulama Hatası</h2>
        <pre style={{ background: '#1a1b24', padding: '1rem', borderRadius: '8px', overflow: 'auto', color: '#fca5a5', fontSize: '12px' }}>
          {error?.message || 'Bilinmeyen hata'}
          {'\n\n'}
          {error?.stack || ''}
        </pre>
        <button
          onClick={reset}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#5e6ad2', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
        >
          Tekrar Dene
        </button>
      </body>
    </html>
  );
}
