"use client";

import { useEffect, useState } from "react";
import { App } from "@/components/gtm/app";
import { DataProvider } from "@/lib/gtm/data";
import { ShareView } from "@/components/gtm/share-view";

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
    <DataProvider>
      <App />
    </DataProvider>
  );
}
