import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Solospace - Multi-Agent Orchestration AI OS',
  description: 'An advanced agent orchestration workspace featuring rich conversation steering and active node clustering.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="font-sans antialiased bg-black text-[#e5e2e1]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

