"use client";

import { useEffect, useState } from "react";
import { App } from "@/components/gtm/app";
import { DataProvider } from "@/lib/gtm/data";

export default function Page() {
  // The shell reads window/localStorage at mount; render client-only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}
