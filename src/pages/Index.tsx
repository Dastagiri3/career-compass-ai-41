import { useEffect, useMemo, useRef, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { JDSidebar, type Conversation } from "@/components/JDSidebar";
import { ChatView, type Msg } from "@/components/ChatView";
import { useAuth } from "@/hooks/useAuth";
import {
  createChat,
  deleteChat as deleteChatDoc,
  subscribeUserChats,
  updateChat,
  type ChatDoc,
} from "@/services/chats";
import { toast } from "sonner";

type ConvState = Conversation & { messages: Msg[] };

const newId = () => Math.random().toString(36).slice(2, 10);
const LOCAL_KEY = "jdbot.guest.chats";

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConvState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const skipNextSync = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<ConvState[]>([]);
  const ensureActivePromiseRef = useRef<Promise<string> | null>(null);
  const authIdentityRef = useRef<string | null | undefined>(undefined);

  const setActiveConversationId = (id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  };

  const setConversationState = (
    next: ConvState[] | ((prev: ConvState[]) => ConvState[]),
  ) => {
    setConversations((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      conversationsRef.current = resolved;
      return resolved;
    });
  };

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Guest mode: persist to localStorage
  useEffect(() => {
    if (user || authLoading) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) setConversationState(JSON.parse(raw));
    } catch {}
  }, [user, authLoading]);

  useEffect(() => {
    if (user || authLoading) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations, user, authLoading]);

  // Reset state when auth identity changes (avoid stale guest/local activeId
  // pointing to a non-existent Firestore doc, which causes permission-denied
  // on update).
  useEffect(() => {
    if (authLoading) return;
    const uid = user?.uid ?? null;
    if (authIdentityRef.current === undefined) {
      authIdentityRef.current = uid;
      return;
    }
    if (authIdentityRef.current !== uid) {
      authIdentityRef.current = uid;
      setActiveConversationId(null);
      setConversationState([]);
    }
  }, [user?.uid, authLoading]);

  // Signed-in: subscribe to Firestore
  useEffect(() => {
    if (!user) return;
    setLoadingChats(true);
    const unsub = subscribeUserChats(
      user.uid,
      (docs: ChatDoc[]) => {
        setLoadingChats(false);
        if (skipNextSync.current) {
          skipNextSync.current = false;
        }
        const nextConversations = docs.map((d) => ({
            id: d.id,
            title: d.title || "New chat",
            messages: d.messages ?? [],
          }));
        setConversationState(nextConversations);
        if (
          activeIdRef.current &&
          !nextConversations.some((c) => c.id === activeIdRef.current)
        ) {
          setActiveConversationId(null);
        }
      },
      (err) => {
        setLoadingChats(false);
        const msg = err.message || "";
        if (/Firestore API has not been used|SERVICE_DISABLED|PERMISSION_DENIED/i.test(msg)) {
          toast.error(
            "Cloud Firestore is disabled for this Firebase project. Open the Firebase console → Firestore Database → Create database, then reload.",
            { duration: 12000 },
          );
        } else {
          toast.error("Could not load chat history: " + msg);
        }
      },
    );
    return () => unsub();
  }, [user]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const ensureActive = (): Promise<string> => {
    // De-dupe concurrent calls within a single send() so we don't create
    // multiple chats for the user message + streaming chunks.
    if (ensureActivePromiseRef.current) return ensureActivePromiseRef.current;
    const currentId = activeIdRef.current;
    if (currentId && conversationsRef.current.some((c) => c.id === currentId)) {
      return Promise.resolve(currentId);
    }
    const promise = (async () => {
      if (user) {
        const id = await createChat(user.uid, "New chat");
        activeIdRef.current = id;
        conversationsRef.current = conversationsRef.current.some((c) => c.id === id)
          ? conversationsRef.current
          : [{ id, title: "New chat", messages: [] }, ...conversationsRef.current];
        setConversationState((prev) =>
          prev.some((c) => c.id === id)
            ? prev
            : [{ id, title: "New chat", messages: [] }, ...prev],
        );
        setActiveConversationId(id);
        return id;
      }
      const id = newId();
      activeIdRef.current = id;
      conversationsRef.current = [
        { id, title: "New chat", messages: [] },
        ...conversationsRef.current,
      ];
      setConversationState((prev) => [{ id, title: "New chat", messages: [] }, ...prev]);
      setActiveConversationId(id);
      return id;
    })();
    ensureActivePromiseRef.current = promise;
    promise.finally(() => {
      ensureActivePromiseRef.current = null;
    });
    return promise;
  };

  const handleNew = async () => {
    if (user) {
      const id = await createChat(user.uid, "New chat");
      setConversationState((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [{ id, title: "New chat", messages: [] }, ...prev],
      );
      setActiveConversationId(id);
      return;
    }
    const id = newId();
    setConversationState((prev) => [{ id, title: "New chat", messages: [] }, ...prev]);
    setActiveConversationId(id);
  };

  const handleSelect = (id: string) => setActiveConversationId(id);

  const handleDelete = async (id: string) => {
    if (user) {
      try {
        await deleteChatDoc(id);
      } catch (e: any) {
        toast.error("Delete failed: " + e.message);
        return;
      }
    } else {
      setConversationState((prev) => prev.filter((c) => c.id !== id));
    }
    if (activeIdRef.current === id) setActiveConversationId(null);
  };

  const updateMessages = async (updater: (prev: Msg[]) => Msg[]) => {
    const id = await ensureActive();
    let nextMessages: Msg[] = [];
    setConversationState((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        nextMessages = updater(c.messages);
        return { ...c, messages: nextMessages };
      }),
    );
    // Keep ref in sync immediately so back-to-back calls within the same
    // tick see the latest messages.
    conversationsRef.current = conversationsRef.current.map((c) =>
      c.id === id ? { ...c, messages: nextMessages } : c,
    );
    if (user) {
      try {
        await updateChat(id, { messages: nextMessages });
      } catch (e) {
        console.error("Failed to save chat", e);
      }
    }
  };

  const handleFirstUserMessage = async (text: string) => {
    const title = text.length > 40 ? text.slice(0, 40).trim() + "…" : text;
    const id = activeIdRef.current;
    if (!id) return;
    setConversationState((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
    if (user) {
      try {
        await updateChat(id, { title });
      } catch (e) {
        console.error(e);
      }
    }
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
                {user ? "Synced" : "Guest"}
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
