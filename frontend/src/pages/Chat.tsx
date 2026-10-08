import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { RiGeminiFill } from "react-icons/ri";
import { api, type ChatMessage } from "../api/client";
import {
  Badge,
  Button,
  ErrorBox,
  Panel,
  inputClass,
} from "../components/ui";

const SUGGESTIONS = [
  "How do I reset my password?",
  "I was charged twice this month",
  "My account seems locked — what should I do?",
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [grounded, setGrounded] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    setGrounded(null);

    try {
      const data = await api.chat(nextMessages);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      setGrounded(data.grounded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden gap-3">
      <header className="shrink-0">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--light-blue-soft)] border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--blue)] mb-2">
          <span className="size-1.5 rounded-full bg-[var(--orange)]" />
          SupportDesk AI
        </div>
        <h1 className="brand-font text-2xl md:text-[1.75rem] text-[var(--ink)] tracking-tight">
          Ask Assistant
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Chat with Gemini, grounded on your FAQ knowledge base.
        </p>
      </header>

      <Panel className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--light-blue-soft)]/60">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--blue)]">
            <RiGeminiFill className="size-4 text-[var(--orange)]" />
            Gemini support chat
          </div>
          {grounded != null && (
            <Badge tone={grounded ? "ok" : "warn"}>
              {grounded ? "FAQ grounded" : "weak FAQ match"}
            </Badge>
          )}
        </div>

        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4"
        >
          {messages.length === 0 && !loading && (
            <div className="h-full min-h-[200px] grid place-items-center text-center px-2">
              <div>
                <div className="mx-auto mb-3 grid place-items-center size-12 rounded-2xl [background:var(--grad-brand)] text-white shadow-[var(--shadow-sm)]">
                  <MessageCircle className="size-5" />
                </div>
                <p className="brand-font text-lg text-[var(--ink)] mb-1">
                  Ask anything about support
                </p>
                <p className="text-sm text-[var(--muted)] mb-4 max-w-md mx-auto">
                  Try a common question to get started.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-[var(--border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--blue)] hover:bg-[var(--light-blue-soft)] transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words shadow-[var(--shadow-sm)]",
                  m.role === "user"
                    ? "bg-[var(--blue)] text-white rounded-br-md"
                    : "bg-white border border-[var(--border)] text-[var(--ink)] rounded-bl-md",
                ].join(" ")}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--orange)] mb-2">
                    <Sparkles className="size-3.5" />
                    Assistant
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
                <Loader2 className="size-4 animate-spin text-[var(--blue)]" />
                Thinking…
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--border)] p-3 bg-white/70">
          {error && (
            <div className="mb-2">
              <ErrorBox message={error} />
            </div>
          )}
          <form onSubmit={onSubmit} className="flex gap-2 items-end">
            <textarea
              className={`${inputClass} min-h-[44px] max-h-24 resize-none`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about passwords, billing, account issues…"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <Button
              type="submit"
              variant="orange"
              disabled={loading || !input.trim()}
              className="shrink-0 h-11 px-4"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
