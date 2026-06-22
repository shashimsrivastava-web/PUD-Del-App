import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { Inter, Space_Grotesk } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'RUSH BAG WIZARD - Advanced Baggage Audit Platform',
  description: 'Enterprise airline baggage barcode reconciliation, dynamic storage registry, manifest checking and audit compliance.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-slate-50 text-slate-900 min-h-screen selection:bg-blue-600 selection:text-white antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
