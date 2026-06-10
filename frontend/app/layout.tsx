import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hosting Yönetim Paneli',
  description: 'Enterprise Hosting Management Panel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#0F172A',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(99,102,241,0.10)',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
            },
          }}
        />
      </body>
    </html>
  );
}
