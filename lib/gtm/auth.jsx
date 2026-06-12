// Per-user auth backbone. When Auth0 is configured the app logs each visitor in
// against the free-trial org and mints a short-lived per-user sk-a79 MCP key, so
// no single shared key leaks one org's data to everyone. When unconfigured the
// app falls back to the env-key single-org path (local dev) unchanged.

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { recordActivity } from "@/lib/gtm/activity";

const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
const AUTH0_ORG = process.env.NEXT_PUBLIC_AUTH0_ORG;
const AUTH0_AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

export const AUTH0_ENABLED = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

export { useAuth0 };

// Module-level holder so non-React callsites (e.g. the chat transport's custom
// fetch) can read the current per-user key without re-minting.
let CURRENT_KEY;
export const getMcpKey = () => CURRENT_KEY;

const KeyCtx = createContext({
  key: undefined,
  userId: undefined,
  orgId: undefined,
  loading: false,
  error: null,
});
export const useMcpKeyContext = () => useContext(KeyCtx);

// Build the per-user Ampersand groupRef. Free-trial orgs share one org_id, so
// user-scoped installs key off `org_id:user_id` (mirrors the product's
// getAmpersandGroupRef). Falls back to the org id when not user-scoped or the
// ids aren't known yet.
export function ampersandGroupRef(orgId, userId, scope) {
  const base = orgId || "";
  if (scope === "user" && base && userId) {
    return `${base}:${userId}`;
  }
  return base;
}

// Mint + refresh the per-user MCP key. Single instance per app (provider-owned);
// React consumers read it via useMcpKeyContext, others via getMcpKey().
export function useMcpKey() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [key, setKey] = useState(undefined);
  const [userId, setUserId] = useState(undefined);
  const [orgId, setOrgId] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const expiryRef = useRef(0);
  const inflightRef = useRef(null);

  useEffect(() => {
    if (!(AUTH0_ENABLED && isAuthenticated)) {
      return;
    }
    let alive = true;

    const mint = async () => {
      if (inflightRef.current) {
        return inflightRef.current;
      }
      const run = (async () => {
        setLoading(true);
        setError(null);
        try {
          const accessToken = await getAccessTokenSilently();
          const res = await fetch("/api/auth/wdk-session", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) {
            throw new Error(`wdk-session ${res.status}`);
          }
          const data = await res.json();
          if (!alive) {
            return;
          }
          CURRENT_KEY = data.token;
          expiryRef.current = data.expires_at ? Date.parse(data.expires_at) : 0;
          setKey(data.token);
          if (data.user_id) {
            setUserId(data.user_id);
          }
          if (data.org_id) {
            setOrgId(data.org_id);
          }
        } catch (e) {
          if (alive) {
            setError(e);
          }
        } finally {
          if (alive) {
            setLoading(false);
          }
          inflightRef.current = null;
        }
      })();
      inflightRef.current = run;
      return run;
    };

    mint();
    // Re-mint when within 60s of expiry.
    const timer = setInterval(() => {
      if (expiryRef.current && Date.now() > expiryRef.current - 60_000) {
        mint();
      }
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAuthenticated, getAccessTokenSilently]);

  if (!AUTH0_ENABLED) {
    return { key: undefined, userId: undefined, orgId: undefined, loading: false, error: null };
  }
  return { key, userId, orgId, loading, error };
}

// Provider that owns the single key mint and publishes it to the subtree.
export function McpKeyProvider({ children }) {
  const value = useMcpKey();
  return <KeyCtx.Provider value={value}>{children}</KeyCtx.Provider>;
}

// After the SDK exchanges the auth code, strip the ?code/&state (and any error)
// params so a reload/back-nav can't replay a now-consumed code, and restore the
// intended path.
function onRedirectCallback(appState) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  for (const p of ["code", "state", "error", "error_description"]) {
    url.searchParams.delete(p);
  }
  const dest = (appState?.returnTo || url.pathname) + url.search + url.hash;
  window.history.replaceState({}, document.title, dest);
}

// Wrap the app in the Auth0 provider when configured; otherwise render children
// directly (single-org / local fallback unchanged).
export function AuthGate({ children }) {
  if (!AUTH0_ENABLED) {
    return <>{children}</>;
  }
  return (
    <Auth0Provider
      authorizationParams={{
        redirect_uri: typeof window === "undefined" ? undefined : window.location.origin,
        organization: AUTH0_ORG,
        audience: AUTH0_AUDIENCE,
      }}
      cacheLocation="localstorage"
      clientId={AUTH0_CLIENT_ID}
      domain={AUTH0_DOMAIN}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens
    >
      {children}
    </Auth0Provider>
  );
}

// Inject the per-user key header into a fetch. Used by every client data call so
// no /api/* request relies on the server env fallback when Auth0 is enabled.
export function apiFetch(path, opts = {}) {
  const k = getMcpKey();
  const init = k ? { ...opts, headers: { ...(opts.headers || {}), "x-ampup-mcp-key": k } } : opts;
  const method = (init.method || "GET").toUpperCase();
  const t0 = Date.now();
  return fetch(path, init).then(
    (res) => {
      recordActivity({ method, path: String(path), status: res.status, ms: Date.now() - t0 });
      return res;
    },
    (err) => {
      recordActivity({ method, path: String(path), status: 0, ms: Date.now() - t0 });
      throw err;
    }
  );
}

// Seed a freshly-connected integration's meetings on install success (backfill
// on connect). Fire-and-forget: the connect flow must never wait on or fail
// because of this. `config` is the Ampersand install config (carries the
// subscribed read objects); `groupRef` is the install's group ref.
export function seedInstallation(installationId, config, { integration, groupRef, provider }) {
  apiFetch("/api/installations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ installationId, config, integration, groupRef, provider }),
  }).catch(() => {});
}
