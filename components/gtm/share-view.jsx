// Public, read-only view of a shared conversation. Rendered by app/page.tsx when
// the URL carries ?share=<id>, BEFORE the authenticated app / DataProvider mount,
// so a recipient with no MCP key can read the transcript. Composer and tool trace
// are intentionally absent — only user prompts and final assistant text are shown.
import React, { useEffect, useState } from "react";
import { Icons, LogoMark } from "./icons";
import { MessageResponse } from "@/components/ai-elements/message";

export function ShareView({ shareId }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    // Public read-only surface: default to the brand dark theme regardless of
    // any local preference (the recipient may never have opened the app).
    const el = document.documentElement;
    el.dataset.theme = "dark"; el.classList.add("dark"); el.dataset.accent = "gold";
    let alive = true;
    fetch(`/api/share/${shareId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setState({ loading: false, transcript: d.transcript }); })
      .catch(() => { if (alive) setState({ loading: false, error: true }); });
    return () => { alive = false; };
  }, [shareId]);

  const transcript = state.transcript;
  const messages = transcript?.messages || [];

  return (
    <div className="share-page">
      <header className="share-bar">
        <div className="share-brand">
          <div className="share-logo"><LogoMark size={18} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="share-title">{transcript?.title || "Shared chat"}</div>
            <div className="share-sub"><Icons.Share size={11} /> Read-only shared conversation</div>
          </div>
        </div>
        <a className="btn btn-sm btn-primary" href="/">Open AmpUp</a>
      </header>

      <div className="scroll share-scroll">
        <div className="chat-inner">
          {state.loading ? (
            <div className="share-empty"><Icons.Refresh size={20} className="spin" /><div style={{ marginTop: 10 }}>Loading conversation…</div></div>
          ) : state.error ? (
            <div className="share-empty"><Icons.Inbox size={26} /><div style={{ marginTop: 10 }}>This shared link is invalid or has expired.</div></div>
          ) : messages.length === 0 ? (
            <div className="share-empty"><Icons.Inbox size={26} /><div style={{ marginTop: 10 }}>This conversation is empty.</div></div>
          ) : messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg-row msg-user"><div className="bubble">{m.text}</div></div>
            ) : (
              <div key={i} className="msg-row msg-agent">
                <div className="msg-avatar" style={{ color: "var(--fg-primary)" }}><LogoMark size={17} /></div>
                <div className="bubble" style={{ flex: 1, minWidth: 0, fontSize: 14.5 }}><MessageResponse>{m.text}</MessageResponse></div>
              </div>
            ),
          )}
          {!state.loading && !state.error && messages.length > 0 && (
            <div className="share-foot">Shared from AmpUp — agents can make mistakes, verify before acting.</div>
          )}
        </div>
      </div>
    </div>
  );
}
