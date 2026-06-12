// Notifications & Activity panel: opens from the bell in the nav rail.
// Two sections: "Setting up your workspace" (live setup progress, passed in
// from App which owns the poller) and "Activity" (recent MCP API calls, read
// directly from the in-memory activity store).
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  labelForPath,
  relTime,
  subscribe,
} from "@/lib/gtm/activity";
import { Icons } from "./icons";

function useDismiss(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (ev) => {
      if (ref.current && !ref.current.contains(ev.target)) {
        onClose();
      }
    };
    const k = (ev) => {
      if (ev.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, []);
  return ref;
}

function SetupSection({ items, active, completed }) {
  if (completed && items.length === 0) {
    return null;
  }
  if (!(active || items.length)) {
    return null;
  }
  return (
    <>
      <div className="navpop-head">Setting up your workspace</div>
      <div className="notif-list">
        {completed ? (
          <div className="notif-row">
            <span className="notif-ico ok">
              <Icons.CheckCircle size={16} />
            </span>
            <div className="notif-body">
              <div className="notif-title">Your workspace is ready</div>
              <div className="notif-sub">Demo content and calendar are synced.</div>
            </div>
          </div>
        ) : (
          items.map((it) => (
            <div className="notif-row" key={it.integration}>
              <span className={"notif-ico" + (it.done ? " ok" : "")}>
                {it.done ? <Icons.CheckCircle size={16} /> : <Icons.Refresh size={15} />}
              </span>
              <div className="notif-body">
                <div className="notif-title">{it.integration}</div>
                <div className="notif-sub">{it.label}</div>
                <div className="notif-bar">
                  <span style={{ width: `${Math.round((it.progress || 0) * 100)}%` }} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function statusTone(status) {
  if (status === 0) {
    return "err";
  }
  return status >= 400 ? "err" : "ok";
}

function ActivitySection() {
  const calls = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <>
      <div className="navpop-head">Activity</div>
      <div className="notif-list">
        {calls.length === 0 ? (
          <div className="notif-empty">No API activity yet.</div>
        ) : (
          calls.slice(0, 40).map((c) => (
            <div className="notif-row" key={c.id}>
              <span className="notif-ico">
                <Icons.Activity size={15} />
              </span>
              <div className="notif-body">
                <div className="notif-title">{labelForPath(c.path)}</div>
                <div className="notif-sub">
                  <span className={"notif-method " + statusTone(c.status)}>{c.method}</span>
                  <span className={"notif-status " + statusTone(c.status)}>
                    {c.status || "err"}
                  </span>
                  <span className="notif-dot">·</span>
                  <span>{relTime(c.ts)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export function NotificationsPanel({ anchor, setup, onClose }) {
  const ref = useDismiss(onClose);
  const style = anchor
    ? {
        position: "fixed",
        left: anchor.left,
        top: Math.min(anchor.top, window.innerHeight - 460),
        zIndex: 90,
      }
    : {};
  return (
    <div className="navpop notif-pop" ref={ref} style={style}>
      <SetupSection
        active={setup?.active}
        completed={setup?.completed}
        items={setup?.items || []}
      />
      <ActivitySection />
    </div>
  );
}
