"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart, type UIMessage } from "ai";
import { useMemo, useRef, useState } from "react";
import { MessageSquareText, ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

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

  const { messages, sendMessage, status, stop } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  };

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col px-4">
      <header className="border-b py-4">
        <h1 className="text-base font-semibold">GTM Agentic Chat</h1>
        <p className="text-muted-foreground text-sm">
          Ask about your accounts, deals, meetings, and pipeline.
        </p>
      </header>

      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquareText className="size-6" />}
              title="Ask about your data"
              description="“List my accounts” · “What are my open opportunities?” · “Summarize my last meeting.”"
            />
          ) : (
            messages.map((m: UIMessage) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={i}>{part.text}</MessageResponse>
                      );
                    }
                    if (part.type.startsWith("tool-")) {
                      const tp = part as ToolUIPart;
                      return (
                        <Tool key={i}>
                          <ToolHeader type={tp.type} state={tp.state} />
                          <ToolContent>
                            <ToolInput input={tp.input} />
                            <ToolOutput
                              output={tp.output}
                              errorText={tp.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="bg-card mb-4 flex items-end gap-2 rounded-2xl border p-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message…"
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        {busy ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={() => stop()}
            aria-label="Stop"
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="rounded-full"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
