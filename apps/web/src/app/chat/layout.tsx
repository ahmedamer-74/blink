"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConversationList } from "@/components/chat/conversation-list";
import { logoutAction } from "@/lib/actions/auth";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    setShowChat(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logoutAction();
    logout();
    router.push("/login");
  };

  return (
    <div className="flex h-dvh" style={{ background: "var(--bg-app)" }}>
      {/* Green header bar — desktop only */}
      <div className="fixed inset-x-0 top-0 z-10 h-[127px] hidden md:block" style={{ background: "var(--accent-dark)" }} />

      <div className="relative z-20 mx-auto flex h-dvh w-full max-w-[1600px] shadow-lg">
        {/* Sidebar */}
        <aside
          className={`flex h-full w-full flex-col border-r md:w-[400px] lg:w-[440px] shrink-0 ${showChat ? "hidden md:flex" : "flex"}`}
          style={{ background: "var(--bg-panel)", borderColor: "var(--divider)" }}
        >
          {/* Sidebar header */}
          <div className="flex h-[59px] items-center justify-between px-4 shrink-0" style={{ borderBottom: "1px solid var(--divider)" }}>
            <h1 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>Blink</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="rounded-full p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                title="Logout"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-secondary)" }}>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
          <ConversationList onOpenChat={() => setShowChat(true)} />
        </aside>

        {/* Chat panel */}
        <main
          className={`flex h-full flex-1 flex-col min-w-0 ${showChat ? "flex" : "hidden md:flex"}`}
          style={{ background: "var(--bg-chat)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
