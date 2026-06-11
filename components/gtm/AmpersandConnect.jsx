// Live Ampersand connect flow (OAuth + field mapping) for one integration.
// Lazy-loaded only when a user clicks "Connect", so @amp-labs/react (and its
// React Query stack) stays out of the main bundle.

import { AmpersandProvider, InstallIntegration } from "@amp-labs/react";
import "@amp-labs/react/styles";

export default function AmpersandConnect({
  integration,
  project,
  apiKey,
  groupRef,
  consumerRef,
  onDone,
  onToast,
  onInstalled,
}) {
  return (
    <AmpersandProvider options={{ project, apiKey }}>
      <InstallIntegration
        consumerRef={consumerRef || groupRef || "default-user"}
        groupRef={groupRef || "default-group"}
        integration={integration}
        onInstallSuccess={(installationId, config) => {
          onToast?.("Connected — syncing your data", "success");
          // Seed the just-connected integration's meetings (backfill on connect).
          // The managed read only delivers events going forward; without this a
          // freshly-connected user sees an empty list. Best-effort, never blocks.
          onInstalled?.(installationId, config);
          onDone?.();
        }}
        onUninstallSuccess={() => {
          onToast?.("Disconnected", "info");
          onDone?.();
        }}
        onUpdateSuccess={() => onToast?.("Connection updated", "success")}
      />
    </AmpersandProvider>
  );
}
