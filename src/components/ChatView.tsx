import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Briefcase, FileText, Sparkles, Target, Bot, User, Paperclip, X, FileType2, TrendingUp, Code2, BarChart3, Megaphone, Palette, Cpu } from "lucide-react";
import { HeroScene } from "@/components/HeroScene";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractPdfText, fileToDataUrl, readTextFile, type AttachedFile } from "@/lib/extractFile";

export type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  messages: Msg[];
  onMessagesChange: (updater: (prev: Msg[]) => Msg[]) => void;
  onFirstUserMessage?: (text: string) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const trendingRoles = [
  { icon: Code2, title: "Frontend Engineer", tag: "Trending", gradient: "from-blue-500/20 to-cyan-500/20", prompt: "Generate a deep analysis & 10 likely interview questions for a Senior Frontend Engineer role (React, TypeScript, performance)." },
  { icon: Cpu, title: "AI / ML Engineer", tag: "🔥 Hot", gradient: "from-violet-500/20 to-fuchsia-500/20", prompt: "Analyze a typical AI/ML Engineer role: required skills, hidden requirements, and likely interview questions." },
  { icon: BarChart3, title: "Data Scientist", tag: "Trending", gradient: "from-emerald-500/20 to-teal-500/20", prompt: "What are the implicit skills usually expected for a Data Scientist role beyond what's listed in JDs?" },
  { icon: Megaphone, title: "Product Manager", tag: "Suited for you", gradient: "from-amber-500/20 to-orange-500/20", prompt: "How can I tailor my resume and prep for a Product Manager role at a SaaS startup?" },
  { icon: Palette, title: "UX Designer", tag: "Suited for you", gradient: "from-pink-500/20 to-rose-500/20", prompt: "Generate likely interview questions and portfolio-review tips for a Senior UX Designer role." },
  { icon: Briefcase, title: "Paste a JD", tag: "Quick action", gradient: "from-slate-500/20 to-zinc-500/20", prompt: "Here's a job description, please analyze it:\n\n[Paste job description here]" },
];

export function ChatView({ messages, onMessagesChange, onFirstUserMessage }: Props) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setIsProcessingFile(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 20MB).`);
          continue;
        }
        const id = Math.random().toString(36).slice(2);
        try {
          if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            const text = await extractPdfText(file);
            setAttachments((p) => [...p, { id, name: file.name, kind: "pdf", text }]);
          } else if (file.type.startsWith("image/")) {
            const dataUrl = await fileToDataUrl(file);
            setAttachments((p) => [...p, { id, name: file.name, kind: "image", dataUrl }]);
          } else if (file.type.startsWith("text/") || /\.(txt|md|json|csv)$/i.test(file.name)) {
            const text = await readTextFile(file);
            setAttachments((p) => [...p, { id, name: file.name, kind: "text", text }]);
          } else {
            toast.error(`Unsupported file: ${file.name}`);
          }
        } catch (err) {
          console.error(err);
          toast.error(`Could not read ${file.name}`);
        }
      }
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((p) => p.filter((a) => a.id !== id));

  const send = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    // Build display content for user message bubble
    const fileSummaries = attachments.map((a) => {
      if (a.kind === "image") return `🖼️ ${a.name}`;
      if (a.kind === "pdf") return `📄 ${a.name}`;
      return `📝 ${a.name}`;
    });
    const autoPromptLabel = !trimmed && attachments.length > 0 ? "Analyze this job description" : "";
    const displayContent = [
      ...(fileSummaries.length ? [fileSummaries.join("\n")] : []),
      trimmed || autoPromptLabel,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Build payload content sent to the model: extracted text + images (multimodal)
    const textParts: string[] = [];
    for (const a of attachments) {
      if (a.kind === "pdf" && a.text) {
        textParts.push(`--- Job description from PDF "${a.name}" ---\n${a.text}`);
      } else if (a.kind === "text" && a.text) {
        textParts.push(`--- File "${a.name}" ---\n${a.text}`);
      }
    }
    const DEFAULT_ANALYZE_PROMPT =
      "Analyze this job description. Extract key skills, responsibilities, hidden requirements, and likely interview questions. Suggest how a candidate can position themselves for this role.";
    if (trimmed) textParts.push(trimmed);
    else if (attachments.length > 0) textParts.push(DEFAULT_ANALYZE_PROMPT);
    const combinedText = textParts.join("\n\n") || DEFAULT_ANALYZE_PROMPT;

    const images = attachments.filter((a) => a.kind === "image" && a.dataUrl);
    const payloadUserContent: any =
      images.length > 0
        ? [
            { type: "text", text: combinedText },
            ...images.map((a) => ({
              type: "image_url",
              image_url: { url: a.dataUrl! },
            })),
          ]
        : combinedText;

    const userMsg: Msg = { role: "user", content: displayContent || combinedText };
    const isFirst = messages.length === 0;
    onMessagesChange((prev) => [...prev, userMsg]);
    if (isFirst) onFirstUserMessage?.(displayContent || trimmed || fileSummaries[0] || "New chat");
    setInput("");
    setAttachments([]);
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
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: payloadUserContent },
      ];
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
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
          <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center px-6 py-12">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
              <HeroScene />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
            </div>

            <div className="relative z-10 mb-10 flex flex-col items-center text-center animate-fade-in">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover-scale">
                <Briefcase className="h-8 w-8" />
              </div>
              <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-5xl">
                Hi, I'm <span className="bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">JDBot</span>
              </h1>
              <p className="max-w-xl text-muted-foreground">
                Drop a JD — PDF, image, or text — and I'll break it down into key skills, hidden
                requirements, interview questions, and resume tips.
              </p>
            </div>

            <div className="relative z-10 w-full">
              <div className="mb-3 flex items-center gap-2 px-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold tracking-tight">Trending & suited for you</h2>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {trendingRoles.map((role, idx) => (
                  <button
                    key={role.title}
                    onClick={() => send(role.prompt)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border border-border bg-card p-4 text-left transition-all duration-300 animate-fade-in",
                      "hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]",
                    )}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                        role.gradient,
                      )}
                    />
                    <div className="relative flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                        <role.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">{role.title}</div>
                          <span className="shrink-0 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                            {role.tag}
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {role.prompt}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-[var(--shadow-soft)]"
                >
                  {a.kind === "image" && a.dataUrl ? (
                    <img src={a.dataUrl} alt={a.name} className="h-7 w-7 rounded object-cover" />
                  ) : a.kind === "pdf" ? (
                    <FileType2 className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                  <span className="max-w-[160px] truncate font-medium">{a.name}</span>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)] focus-within:border-primary/40 focus-within:shadow-[var(--shadow-glow)] transition-all">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,image/*,.txt,.md,.json,.csv,text/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isProcessingFile}
              className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-primary"
              title="Attach JD (PDF, image, or text)"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                isProcessingFile
                  ? "Reading file…"
                  : "Paste a JD, attach a file, or ask a career question…"
              }
              className="min-h-[52px] max-h-48 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              disabled={isStreaming}
            />
            <Button
              onClick={() => send(input)}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming || isProcessingFile}
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
