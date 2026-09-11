"use client";

import React, { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { SidebarProvider, useSidebar } from "@/context/sidebar-context";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
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
    <div className="flex h-screen overflow-hidden relative">
      {/* Drawer Sidebar — fixed overlay, does not push content */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar onMenuClick={toggle} />
        <main className="flex-1 overflow-y-auto bg-surface-50 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </SidebarProvider>
  );
}
