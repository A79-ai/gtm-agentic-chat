// Live Ampersand connect flow (OAuth + field mapping) for one integration.
// Lazy-loaded only when a user clicks "Connect", so @amp-labs/react (and its
// React Query stack) stays out of the main bundle.
import React from "react";
import { AmpersandProvider, InstallIntegration } from "@amp-labs/react";
import "@amp-labs/react/styles";

export default function AmpersandConnect({ integration, project, apiKey, groupRef, consumerRef, onDone, onToast }) {
  return (
    <AmpersandProvider options={{ project, apiKey }}>
      <InstallIntegration
        integration={integration}
        consumerRef={consumerRef || groupRef || "default-user"}
        groupRef={groupRef || "default-group"}
        onInstallSuccess={() => { onToast?.("Connected — syncing your data", "success"); onDone?.(); }}
        onUpdateSuccess={() => onToast?.("Connection updated", "success")}
        onUninstallSuccess={() => { onToast?.("Disconnected", "info"); onDone?.(); }}
      />
    </AmpersandProvider>
  );
}
