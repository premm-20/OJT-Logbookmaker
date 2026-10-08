"use client";

import React, { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { SidebarProvider, useSidebar } from "@/context/sidebar-context";
import { syncClientIdentity, type ClientUser } from "@/lib/auth/client-identity";

function DashboardShellInner({ user, children }: { user: ClientUser; children: React.ReactNode }) {
  const { toggle } = useSidebar();

  // Ctrl+B / Cmd+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return (
    <div className="flex h-[100dvh] overflow-hidden relative">
      {/* Drawer Sidebar — fixed overlay, does not push content */}
      <Sidebar user={user} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar user={user} onMenuClick={toggle} />
        <main id="main" className="flex-1 overflow-y-auto bg-surface-50 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell({ user, children }: { user: ClientUser; children: React.ReactNode }) {
  // The pages below read the student's id from localStorage inside their own
  // effects, which run before this component's effects. Sync during render
  // (idempotent, browser only) so they always see the signed-in student.
  if (typeof window !== "undefined") syncClientIdentity(user);

  return (
    <SidebarProvider>
      <DashboardShellInner user={user}>{children}</DashboardShellInner>
    </SidebarProvider>
  );
}
