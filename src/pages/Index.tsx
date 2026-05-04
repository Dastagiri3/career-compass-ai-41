import { useMemo, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { JDSidebar, type Conversation } from "@/components/JDSidebar";
import { ChatView, type Msg } from "@/components/ChatView";

type ConvState = Conversation & { messages: Msg[] };

const newId = () => Math.random().toString(36).slice(2, 10);

const Index = () => {
  const [conversations, setConversations] = useState<ConvState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const ensureActive = (): string => {
    if (activeId && conversations.some((c) => c.id === activeId)) return activeId;
    const id = newId();
    setConversations((prev) => [{ id, title: "New chat", messages: [] }, ...prev]);
    setActiveId(id);
    return id;
  };

  const handleNew = () => {
    const id = newId();
    setConversations((prev) => [{ id, title: "New chat", messages: [] }, ...prev]);
    setActiveId(id);
  };

  const handleSelect = (id: string) => setActiveId(id);

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const updateMessages = (updater: (prev: Msg[]) => Msg[]) => {
    const id = ensureActive();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, messages: updater(c.messages) } : c)),
    );
  };

  const handleFirstUserMessage = (text: string) => {
    const title = text.length > 40 ? text.slice(0, 40).trim() + "…" : text;
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, title } : c)),
    );
  };

  const messages = active?.messages ?? [];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <JDSidebar
          conversations={conversations.map(({ id, title }) => ({ id, title }))}
          activeId={activeId}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
        />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="flex flex-1 items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold leading-none">
                  {active?.title ?? "JDBot"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Job description analyst & interview coach
                </p>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <ChatView
              messages={messages}
              onMessagesChange={updateMessages}
              onFirstUserMessage={handleFirstUserMessage}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
