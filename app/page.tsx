"use client";

import { useEffect, useState } from "react";
import { App } from "@/components/gtm/app";
import { DataProvider } from "@/lib/gtm/data";
import { ShareView } from "@/components/gtm/share-view";
import { AuthGate, AUTH0_ENABLED, McpKeyProvider, useAuth0, useMcpKeyContext } from "@/lib/gtm/auth";
import { LogoMark } from "@/components/gtm/icons";

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
      <div className="flow-overlay">
        <div
          style={{
            textAlign: "center",
            maxWidth: 380,
            width: "100%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-xl)",
            padding: "40px 32px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <LogoMark size={40} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 8px" }}>Sign in to AmpUp</h1>
          <p style={{ color: "var(--fg-muted)", margin: "0 0 28px" }}>
            Continue to your GTM workspace.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => loginWithRedirect()}>
            Continue with Google
          </button>
        </div>
      </div>
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
