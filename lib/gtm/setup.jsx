// Live setup-progress poller. After onboarding the backend seed (demo content)
// + Google Calendar sync run as background backfills for minutes; this polls
// /api/onboarding/sync-status and exposes grouped, friendly progress.
//
// Lifecycle:
// - Runs only when multi-tenant (Auth0) AND signed in (per-user key present).
// - Starts when armed (just after onboarding) OR when a quick first poll on
//   load reports setup is not yet complete.
// - Polls every ~6s; hard cap of ~6 min so it can never poll forever.
// - On the not-complete -> complete edge it fires onComplete() once (the caller
//   re-pulls records and surfaces a "ready" notification).
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/gtm/auth";

const POLL_MS = 6000;
const CAP_MS = 6 * 60 * 1000;

// A just-armed run polls at least this many times before trusting a
// sync_completed=true, so a 404-driven fail-open right after onboarding (the
// backfill job may not be registered yet) can't instantly defeat the poller.
const MIN_ARMED_POLLS = 3;

function friendlyObject(name) {
  const n = (name || "").trim();
  if (!n) {
    return "Records";
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Group raw backfills by integration_name into display items with a combined
// label and averaged progress.
function groupBackfills(backfills) {
  const groups = new Map();
  for (const b of backfills || []) {
    const key = b.integration_name || "Workspace";
    const g = groups.get(key) || {
      integration: key,
      objects: [],
      messages: [],
      total: 0,
      progress: 0,
      done: 0,
    };
    g.objects.push(friendlyObject(b.object_name));
    // The backend sets a live progress message on in-flight tasks (e.g. the
    // demo-content seed: "Created 4 accounts and 5 deals, adding more..."), so
    // prefer it over the static object list to make the panel read like a feed.
    if (typeof b.message === "string" && b.message.trim()) {
      g.messages.push(b.message.trim());
    }
    g.total += 1;
    g.progress += typeof b.progress === "number" ? b.progress : 0;
    const status = (b.status || "").toUpperCase();
    if (status === "COMPLETED") {
      g.done += 1;
    }
    groups.set(key, g);
  }
  return Array.from(groups.values()).map((g) => ({
    integration: g.integration,
    label: g.messages.length
      ? g.messages.at(-1)
      : g.objects.slice(0, 3).join(", ") + (g.objects.length > 3 ? "..." : ""),
    progress: g.total ? g.progress / g.total : 0,
    done: g.done === g.total && g.total > 0,
  }));
}

export function useSetupProgress({ enabled, armed, onComplete }) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const completeFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let alive = true;
    let timer = null;
    const startedAt = Date.now();
    let polls = 0;
    // True once we've seen a genuine in-progress poll, so the completion edge
    // fires even if the final "done" response carries no backfill items.
    let sawActive = false;

    const finish = (showReady) => {
      if (!alive) {
        return;
      }
      setActive(false);
      setCompleted(true);
      if (showReady && !completeFiredRef.current) {
        completeFiredRef.current = true;
        try {
          onCompleteRef.current?.();
        } catch {
          // The completion callback (refresh + toast) is best-effort UI work.
        }
      }
    };

    const tick = async () => {
      if (!alive) {
        return;
      }
      polls += 1;
      let data;
      try {
        const r = await apiFetch("/api/onboarding/sync-status");
        data = r.ok ? await r.json() : null;
      } catch {
        data = null;
      }
      if (!alive) {
        return;
      }
      const backfills = Array.isArray(data?.backfills) ? data.backfills : [];
      const grouped = groupBackfills(backfills);
      setItems(grouped);

      const upstreamDone = data?.sync_completed === true;
      // Armed runs ignore an early "done" with no items (fail-open / job not
      // registered yet) until we've polled a few times.
      const trustDone = upstreamDone && (!armed || polls >= MIN_ARMED_POLLS || grouped.length > 0);

      if (trustDone) {
        // Only surface the "ready" notification if there was something to set up
        // (armed run, or we observed an in-progress poll along the way), not for
        // a steady-state already-done load.
        finish(armed || sawActive);
        return;
      }
      if (Date.now() - startedAt > CAP_MS) {
        finish(false);
        return;
      }
      sawActive = true;
      if (!active) {
        setActive(true);
      }
      timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      alive = false;
      if (timer) {
        clearTimeout(timer);
      }
    };
    // armed flips false->true once after onboarding; restart the poll loop then.
  }, [enabled, armed]);

  return { items, active, completed };
}
