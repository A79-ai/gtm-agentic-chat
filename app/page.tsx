"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";

export default function Page() {
  // One conversation per page load. The durable run id comes back on the first
  // response and is threaded into every follow-up turn.
  const conversationId = useMemo(() => crypto.randomUUID(), []);
  const runIdRef = useRef<string | undefined>(undefined);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Capture the durable run id off the response header for follow-ups.
        fetch: async (url, options) => {
          const res = await fetch(url as string, options);
          const id = res.headers.get("x-workflow-run-id");
          if (id) runIdRef.current = id;
          return res;
        },
        // Send only the latest user message + our conversation/run identifiers.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            conversationId,
            message: messages[messages.length - 1],
            runId: runIdRef.current,
          },
        }),
      }),
    [conversationId],
  );

  const { messages, sendMessage, status } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>GTM Agentic Chat</h1>
        <p>Ask about your accounts, deals, meetings, and pipeline.</p>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            Try: &ldquo;List my accounts&rdquo; · &ldquo;What are my open
            opportunities?&rdquo; · &ldquo;Summarize my last meeting.&rdquo;
          </div>
        )}
        {messages.map((m: UIMessage) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="bubble">{renderParts(m)}</div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <div className="bubble" style={{ color: "var(--muted)" }}>
              …
            </div>
          </div>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function renderParts(m: UIMessage) {
  return m.parts.map((part, i) => {
    if (part.type === "text") return <span key={i}>{part.text}</span>;
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const name =
        "toolName" in part
          ? (part as { toolName: string }).toolName
          : part.type.replace(/^tool-/, "");
      return (
        <div key={i} className="tool">
          ⚙ {name.replace(/^mcp__ampup__/, "")}
        </div>
      );
    }
    return null;
  });
}
