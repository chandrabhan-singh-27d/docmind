import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DocMind — Chat With Your Documents',
  description:
    'RAG-powered knowledge base with citations. Upload documents, ask questions, get answers with source references.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const t = localStorage.getItem('docmind-theme'); const sys = window.matchMedia('(prefers-color-scheme: dark)').matches; const dark = t ? t === 'dark' : sys; document.documentElement.classList.add(dark ? 'dark' : 'light'); } catch (_) {} })();`,
          }}
        />
      </head>
      <body className="h-full flex flex-col overflow-hidden bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
