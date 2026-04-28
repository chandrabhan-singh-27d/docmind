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
            __html: `(() => { try { const t = localStorage.getItem('docmind-theme'); const sys = window.matchMedia('(prefers-color-scheme: dark)').matches; const isDark = t === 'dark' || ((t === null || t === 'system') && sys); document.documentElement.classList.add(isDark ? 'dark' : 'light'); } catch (_) {} })();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { var post = function (lvl, msg, stk, ctx) { try { var body = JSON.stringify({ level: lvl, message: msg, stack: stk, url: location.href, context: ctx }); if (navigator.sendBeacon) { var ok = navigator.sendBeacon('/api/logs/event', new Blob([body], { type: 'application/json' })); if (ok) return; } fetch('/api/logs/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {}); } catch (_) {} }; window.addEventListener('error', function (e) { post('error', (e && e.message) || 'Unhandled error', e && e.error && e.error.stack, { source: 'window.onerror' }); }); window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; var msg = (r && r.message) || (typeof r === 'string' ? r : 'Unhandled promise rejection'); post('error', msg, r && r.stack, { source: 'unhandledrejection' }); }); })();`,
          }}
        />
      </head>
      <body className="h-full flex flex-col overflow-hidden bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
