import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Briefcase, FileText, Sparkles, Target, Bot, User, Paperclip, X, Image as ImageIcon, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractPdfText, fileToDataUrl, readTextFile, type AttachedFile } from "@/lib/extractFile";

export type MsgContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
export type Msg = { role: "user" | "assistant"; content: string | MsgContentPart[] };

interface Props {
  messages: Msg[];
  onMessagesChange: (updater: (prev: Msg[]) => Msg[]) => void;
  onFirstUserMessage?: (text: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const examples = [
  {
    icon: FileText,
    title: "Analyze a JD",
    prompt:
      "Here's a job description, please analyze it:\n\n[Paste job description here]",
  },
  {
    icon: Sparkles,
    title: "Interview prep",
    prompt: "Generate 10 likely interview questions for a Senior Frontend Engineer role with React and TypeScript.",
  },
  {
    icon: Target,
    title: "Resume tips",
    prompt: "How can I tailor my resume for a Product Manager role at a SaaS startup?",
  },
  {
    icon: Briefcase,
    title: "Hidden requirements",
    prompt: "What are the implicit skills usually expected for a Data Scientist role beyond what's listed?",
  },
];

export function ChatView({ messages, onMessagesChange, onFirstUserMessage }: Props) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    const isFirst = messages.length === 0;
    onMessagesChange((prev) => [...prev, userMsg]);
    if (isFirst) onFirstUserMessage?.(trimmed);
    setInput("");
    setIsStreaming(true);

    let assistantSoFar = "";
    let assistantStarted = false;
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      onMessagesChange((prev) => {
        if (!assistantStarted) {
          assistantStarted = true;
          return [...prev, { role: "assistant", content: assistantSoFar }];
        }
        return prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
        );
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast.error("Rate limit exceeded. Please wait a moment.");
        } else if (resp.status === 402) {
          toast.error("AI credits exhausted. Please add funds in Settings.");
        } else {
          toast.error("Failed to reach JDBot. Please try again.");
        }
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const showWelcome = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Briefcase className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
              Hi, I'm <span className="text-primary">JDBot</span>
            </h1>
            <p className="mb-10 max-w-lg text-muted-foreground">
              Paste a job description and I'll break it down — key skills, hidden requirements,
              interview questions, and how to position your resume.
            </p>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              {examples.map((ex) => (
                <button
                  key={ex.title}
                  onClick={() => send(ex.prompt)}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ex.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{ex.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {ex.prompt}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} msg={m} />
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3">
                  <Avatar role="assistant" />
                  <div className="flex items-center gap-1 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-3xl p-4">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/40 focus-within:shadow-[var(--shadow-glow)] transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Paste a job description or ask a career question…"
              className="min-h-[52px] max-h-48 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              disabled={isStreaming}
            />
            <Button
              onClick={() => send(input)}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-10 w-10 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            JDBot focuses on careers, jobs, and hiring. Press <kbd className="rounded border bg-muted px-1">Enter</kbd> to send.
          </p>
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        role === "assistant"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
      )}
    >
      {role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar role={msg.role} />
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-[var(--shadow-soft)]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card text-card-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
