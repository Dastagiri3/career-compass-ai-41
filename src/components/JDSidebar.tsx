import { Briefcase, Plus, MessageSquare, Sparkles, FileText, Trash2, LogIn, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

function UserPanel() {
  const { user, signInWithGoogle, logout, loading } = useAuth();
  if (loading) {
    return <div className="px-2 py-2 text-xs text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="p-2">
        <Button onClick={signInWithGoogle} variant="outline" size="sm" className="w-full justify-start gap-2">
          <LogIn className="h-4 w-4" /> Sign in with Google
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-2">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-medium">{user.displayName ?? "User"}</div>
        <div className="truncate text-[10px] text-muted-foreground">{user.email}</div>
      </div>
      <button onClick={logout} className="text-muted-foreground hover:text-destructive" aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export type Conversation = {
  id: string;
  title: string;
};

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

const quickPrompts = [
  { icon: FileText, label: "Analyze a JD" },
  { icon: Sparkles, label: "Interview questions" },
  { icon: MessageSquare, label: "Resume tips" },
];

export function JDSidebar({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Briefcase className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-semibold tracking-tight" style={{ fontFamily: "Sora" }}>
                JDBot
              </span>
              <span className="text-xs text-muted-foreground">Career assistant</span>
            </div>
          )}
        </div>
        <div className="px-2 pb-2">
          <Button
            onClick={onNew}
            className="w-full justify-start gap-2 bg-primary hover:bg-primary/90"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span>New chat</span>}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>Quick actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {quickPrompts.map((p) => (
                  <SidebarMenuItem key={p.label}>
                    <SidebarMenuButton className="text-muted-foreground">
                      <p.icon className="h-4 w-4" />
                      <span>{p.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations.length === 0 && !collapsed && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No chats yet. Paste a job description to begin.
                </p>
              )}
              {conversations.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton
                    isActive={c.id === activeId}
                    onClick={() => onSelect(c.id)}
                    className={cn("group/item", c.id === activeId && "font-medium")}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate flex-1">{c.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(c.id);
                          }}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity hover:text-destructive"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && <UserPanel />}
      </SidebarFooter>
    </Sidebar>
  );
}
