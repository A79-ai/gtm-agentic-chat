"use client";

// Chrome-less, embeddable chat surface. Renders ONLY the chat (no SideNav,
// onboarding, billing or marketing chrome) so it can live in a customer's
// iframe or a floating widget. Framing is allowlisted via the CSP
// `frame-ancestors` header set in next.config.ts (EMBED_ALLOWED_ORIGINS).
//
// Auth: same per-user `sk-a79` flow as the main app, but sign-in uses
// `loginWithPopup()`: a first-party popup runs Auth0 Universal Login at the top
// level, sidestepping the iframe clickjacking block (Auth0 sends
// `frame-ancestors 'none'`) and the third-party-cookie loss that breaks the
// redirect/silent flow inside a cross-site iframe. The provider already uses
// refresh-token rotation (`useRefreshTokens`), so renewal needs no 3P cookies.
import { useEffect, useState } from "react";
import { ChatScreen } from "@/components/gtm/chat";
import {
  AUTH0_ENABLED,
  AuthGate,
  McpKeyProvider,
  useAuth0,
  useMcpKeyContext,
} from "@/lib/gtm/auth";
import { DataProvider } from "@/lib/gtm/data";

function EmbedChat() {
  // Reuse the app shell's flex-column height (`.app` → `--app-h`/100dvh) so the
  // chat fills the iframe and the composer pins to the bottom.
  return (
    <DataProvider>
      <div className="app embed-app">
        <main className="main">
          <ChatScreen
            agent={null}
            onBack={null}
            onNav={() => {}}
            onNewChat={() => {}}
            onOpenConversation={() => {}}
            onOpenRecord={() => {}}
            onToast={() => {}}
            resume={null}
            seedAttached={[]}
          />
        </main>
      </div>
    </DataProvider>
  );
}

function SignInPanel({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="embed-signin">
      <div className="embed-signin-card">
        <h1>Sign in to chat</h1>
        <p>Connect your workspace to start chatting over your CRM, calls and notes.</p>
        <button className="btn btn-primary btn-lg" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    </div>
  );
}

function EmbedAuthed() {
  const { key } = useMcpKeyContext();
  if (!key) {
    return null; // defer until the per-user key is minted
  }
  return <EmbedChat />;
}

function EmbedGate() {
  const { isLoading, isAuthenticated, loginWithPopup, loginWithRedirect } = useAuth0();
  if (!AUTH0_ENABLED) {
    return <EmbedChat />; // single-org dev
  }
  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    const signIn = async () => {
      try {
        await loginWithPopup();
      } catch {
        // Popup blocked or closed, so fall back to a full redirect (works when the
        // embed is the top-level page rather than framed).
        loginWithRedirect();
      }
    };
    return <SignInPanel onSignIn={signIn} />;
  }
  return (
    <McpKeyProvider>
      <EmbedAuthed />
    </McpKeyProvider>
  );
}

export default function EmbedPage() {
  // Reads window/localStorage at mount; render client-only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Widget handshake: announce ready to the embedding host and accept theme
  // from it. Origin-scoped both ways: outbound uses the referrer origin (the
  // framing page), inbound is checked against it. No '*'.
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) {
      return;
    }
    let hostOrigin = "";
    try {
      hostOrigin = document.referrer ? new URL(document.referrer).origin : "";
    } catch {
      hostOrigin = "";
    }
    const onMsg = (e: MessageEvent) => {
      if (hostOrigin && e.origin !== hostOrigin) {
        return;
      }
      const d = (e.data || {}) as { type?: string; theme?: string };
      if (d.type === "ampup:host" && d.theme) {
        document.documentElement.dataset.theme = d.theme;
        document.documentElement.classList.toggle("dark", d.theme === "dark");
      }
    };
    window.addEventListener("message", onMsg);
    if (hostOrigin) {
      try {
        window.parent.postMessage({ type: "ampup:ready" }, hostOrigin);
      } catch {
        // Best-effort handshake.
      }
    }
    return () => window.removeEventListener("message", onMsg);
  }, []);
  if (!mounted) {
    return null;
  }
  return (
    <AuthGate>
      <EmbedGate />
    </AuthGate>
  );
}
