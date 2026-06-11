// Headless Google Calendar connect for onboarding. Unlike InstallIntegration
// (which renders Ampersand's raw field-mapping UI + "Stop reading" toggle), this
// owns the entire visual: we show our own states and let Ampersand do only the
// OAuth handshake (ConnectProvider) and the installation (created silently with
// all fields auto-selected). Lazy-loaded so @amp-labs/react stays out of the
// main bundle.

import {
  AmpersandProvider,
  ConnectProvider,
  InstallationProvider,
  useConnection,
  useCreateInstallation,
  useInstallation,
  useManifest,
} from "@amp-labs/react";
import "@amp-labs/react/styles";
import { useEffect, useRef } from "react";

// Once OAuth lands, create the read installation with every field auto-selected
// — no field picker, matching the amp.yaml `inheritFieldsAndMapping` read config.
function HeadlessInstall({
  provider,
  module,
  consumerRef,
  groupRef,
  onDone,
  onToast,
  onInstalled,
}) {
  const { connection } = useConnection();
  const { installation, isFetching: instFetching } = useInstallation();
  const { createInstallation } = useCreateInstallation();
  const { getReadObjects, isLoading: manifestLoading } = useManifest();
  const creating = useRef(false);

  useEffect(() => {
    // Already installed (e.g. a returning user) → nothing to do.
    if (installation) {
      onDone?.();
      return;
    }
    if (!connection || instFetching || manifestLoading || creating.current) {
      return;
    }

    const objects = {};
    for (const o of getReadObjects() || []) {
      if (o?.objectName) {
        objects[o.objectName] = { objectName: o.objectName, selectedFieldsAuto: "all" };
      }
    }
    if (!Object.keys(objects).length) {
      return; // manifest not ready yet
    }

    creating.current = true;
    createInstallation({
      config: { read: { objects } },
      onSuccess: (inst) => {
        onToast?.("Connected — syncing your calendar", "success");
        onInstalled?.(inst.id, inst.config);
        onDone?.();
      },
      onError: () => {
        creating.current = false; // allow a retry
        onToast?.("Couldn't finish connecting — please try again", "error");
      },
    });
  }, [connection, installation, instFetching, manifestLoading]);

  if (installation) {
    return null; // onDone fired
  }
  if (!connection) {
    // The only Ampersand-rendered UI: the OAuth connect step.
    return (
      <ConnectProvider
        consumerRef={consumerRef}
        groupRef={groupRef}
        module={module}
        provider={provider}
      />
    );
  }
  return <div className="cal-installing">Finishing setup…</div>;
}

export default function CalendarConnect({
  integration,
  provider,
  module,
  project,
  apiKey,
  groupRef,
  consumerRef,
  onDone,
  onToast,
  onInstalled,
}) {
  const consumer = consumerRef || groupRef || "default-user";
  const group = groupRef || "default-group";
  return (
    <AmpersandProvider options={{ project, apiKey }}>
      <InstallationProvider consumerRef={consumer} groupRef={group} integration={integration}>
        <HeadlessInstall
          consumerRef={consumer}
          groupRef={group}
          module={module}
          onDone={onDone}
          onInstalled={onInstalled}
          onToast={onToast}
          provider={provider}
        />
      </InstallationProvider>
    </AmpersandProvider>
  );
}
