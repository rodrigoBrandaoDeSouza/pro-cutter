import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/app/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'pro-cutter', template: '%s · pro-cutter' },
  description: 'Planejamento de corte de chapas para marcenarias',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
