// Per-connector sync status (Ampersand backfill / replay progress). Fetched
// once when the connectors load and exposed to the home + connectors screens.
// Kept lightweight: one fetch on mount plus an optional manual refresh; no
// aggressive polling.
import { useEffect, useState } from "react";
import { AUTH0_ENABLED, apiFetch, useMcpKeyContext } from "@/lib/gtm/auth";

// Module singleton so non-hook callsites can read the latest map synchronously,
// mirroring the connectors store in data.jsx.
let SYNC_STORE = {};
export const getConnectorSync = () => SYNC_STORE;
export function setConnectorSync(payload) {
  SYNC_STORE = payload && typeof payload.sync === "object" && payload.sync ? payload.sync : {};
}

// Resolve a connector's sync entry by its provider/id, matched against the
// Ampersand integration_name (keyed lowercase by the proxy route).
export function syncFor(connector, sync = SYNC_STORE) {
  if (!connector) {
    return null;
  }
  const provider = (connector.provider || "").toLowerCase();
  const id = (connector.id || "").toLowerCase();
  return sync[provider] || sync[id] || null;
}

// Fetch the sync map once on mount and force a re-render when it lands. In
// multi-tenant mode wait for the per-user key (same gate as DataProvider).
export function useConnectorSync() {
  const [sync, setSync] = useState(SYNC_STORE);
  const { key } = useMcpKeyContext();
  const fetchSync = () =>
    apiFetch("/api/connectors/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setConnectorSync(data);
          setSync(SYNC_STORE);
        }
      })
      .catch(() => {});
  useEffect(() => {
    if (AUTH0_ENABLED && !key) {
      return;
    }
    let alive = true;
    apiFetch("/api/connectors/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setConnectorSync(data);
          setSync(SYNC_STORE);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return { sync, refresh: fetchSync };
}
