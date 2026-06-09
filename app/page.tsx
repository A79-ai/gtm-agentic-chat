"use client";

import { useEffect, useState } from "react";
import { App } from "@/components/gtm/app";
import { DataProvider } from "@/lib/gtm/data";
import { ShareView } from "@/components/gtm/share-view";
import { AuthGate, AUTH0_ENABLED, McpKeyProvider, useAuth0, useMcpKeyContext } from "@/lib/gtm/auth";
import { Welcome } from "@/components/gtm/welcome";

// Inner gate: reads Auth0 state (only valid inside AuthGate's provider) and
// decides login vs app. When Auth0 is disabled it renders the app as before.
function Gated() {
  const { isLoading, isAuthenticated, loginWithRedirect } = useAuth0();

  if (!AUTH0_ENABLED) {
    return (
      <DataProvider>
        <App />
      </DataProvider>
    );
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <Welcome
        onLogin={() => loginWithRedirect()}
        // The free-trial org disables the separate signup flow (screen_hint=signup
        // → "signup is disabled for organization"). New users are auto-provisioned
        // on first login, so both CTAs go to the same Universal Login.
        onSignup={() => loginWithRedirect()}
        // Skip the account-picker and go straight to Google.
        onGoogle={() =>
          loginWithRedirect({ authorizationParams: { connection: "google-oauth2" } })
        }
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
  if (!key) return null;
  return (
    <DataProvider>
      {/* App is a JS component; authUser/onAuth0Logout are consumed at runtime. */}
      <App
        {...({
          authUser: user,
          onAuth0Logout: () =>
            logout({ logoutParams: { returnTo: window.location.origin } }),
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
  if (!mounted) return null;
  // Public, read-only share link: render the transcript without the app, auth or
  // DataProvider — a recipient has no MCP key.
  if (shareId) return <ShareView shareId={shareId} />;
  return (
    <AuthGate>
      <Gated />
    </AuthGate>
  );
}
