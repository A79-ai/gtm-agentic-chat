"use client";

import { useEffect, useState } from "react";
import { App } from "@/components/gtm/app";
import { ShareView } from "@/components/gtm/share-view";
import { Welcome } from "@/components/gtm/welcome";
import {
  AUTH0_ENABLED,
  AuthGate,
  McpKeyProvider,
  useAuth0,
  useMcpKeyContext,
} from "@/lib/gtm/auth";
import { DataProvider } from "@/lib/gtm/data";

// Inner gate: reads Auth0 state (only valid inside AuthGate's provider) and
// decides login vs app. When Auth0 is disabled it renders the app as before.
function AuthError({ detail, onRetry }: { detail?: string; onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0b0c",
        color: "#fff",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>
          Sign-in didn&apos;t finish
        </h1>
        <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
          We couldn&apos;t complete the login{detail ? ` (${detail})` : ""}. This usually clears up
          on a retry.
        </p>
        <button
          onClick={onRetry}
          style={{
            background: "#FFB712",
            color: "#1a1a1a",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Try signing in again
        </button>
      </div>
    </div>
  );
}

function Gated() {
  const { isLoading, isAuthenticated, loginWithRedirect, error } = useAuth0();

  if (!AUTH0_ENABLED) {
    return (
      <DataProvider>
        <App />
      </DataProvider>
    );
  }

  if (isLoading) {
    return null;
  }

  // A failed callback (expired/replayed code, "invalid state", consent denied)
  // leaves us unauthenticated — either with an `error`, or rarely with the
  // `?code` still in the URL and no error. Surface a clear retry instead of
  // silently dropping to the marketing splash (which looks like login did
  // nothing). Retrying starts a fresh transaction, which clears it.
  const stuckCallback = typeof window !== "undefined" && /[?&]code=/.test(window.location.search);
  if (error || (!isAuthenticated && stuckCallback)) {
    return <AuthError detail={error?.message} onRetry={() => loginWithRedirect()} />;
  }

  if (!isAuthenticated) {
    return (
      <Welcome
        // Skip the account-picker and go straight to Google.
        onGoogle={() => loginWithRedirect({ authorizationParams: { connection: "google-oauth2" } })}
        onLogin={() => loginWithRedirect()}
        // The free-trial org disables the separate signup flow (screen_hint=signup
        // → "signup is disabled for organization"). New users are auto-provisioned
        // on first login, so both CTAs go to the same Universal Login.
        onSignup={() => loginWithRedirect()}
      />
    );
  }

  return (
    <McpKeyProvider>
      <AuthedApp />
    </McpKeyProvider>
  );
}

// Defer the data subtree until the per-user key is minted, so no /api/* fetch
// fires without it (which would 401 under MULTI_TENANT).
function AuthedApp() {
  const { key } = useMcpKeyContext();
  const { user, logout } = useAuth0();
  if (!key) {
    return null;
  }
  return (
    <DataProvider>
      {/* App is a JS component; authUser/onAuth0Logout are consumed at runtime. */}
      <App
        {...({
          authUser: user,
          onAuth0Logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
        } as unknown as Record<string, never>)}
      />
    </DataProvider>
  );
}

export default function Page() {
  // The shell reads window/localStorage at mount; render client-only.
  const [mounted, setMounted] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("share");
    setShareId(id);
    setMounted(true);
  }, []);
  if (!mounted) {
    return null;
  }
  // Public, read-only share link: render the transcript without the app, auth or
  // DataProvider — a recipient has no MCP key.
  if (shareId) {
    return <ShareView shareId={shareId} />;
  }
  return (
    <AuthGate>
      <Gated />
    </AuthGate>
  );
}
