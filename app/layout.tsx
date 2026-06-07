import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmpUp · GTM Agent",
  description: "Chat over your CRM, meetings, and knowledge base.",
};

// Set theme/accent/density before paint to avoid a flash.
const themeScript = `(function(){try{
  var pref = localStorage.getItem('ampup-theme') || 'dark';
  var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var resolved = pref === 'system' ? sys : pref;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.dataset.accent = localStorage.getItem('ampup-accent') || 'gold';
  document.documentElement.dataset.density = localStorage.getItem('ampup-density') || 'comfortable';
}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
