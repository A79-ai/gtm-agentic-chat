import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmpUp · GTM Agent",
  description: "Chat over your CRM, meetings, and knowledge base.",
};

// `viewportFit: "cover"` is required for `env(safe-area-inset-*)` to resolve to
// anything but 0 on notched devices. `interactiveWidget: "resizes-content"`
// shrinks the layout viewport when the on-screen keyboard opens on Android so
// `100dvh` tracks above it (iOS needs the visualViewport JS in app.jsx).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Serif:wght@400;700&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, author-controlled no-flash theme script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
