"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, BookOpen } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/new-entry": "New Entry",
  "/dashboard/profile": "Profile",
  "/dashboard/edit-pdf": "Edit PDF",
  "/dashboard/feedback": "Supervisor Feedback",
  "/dashboard/logbook": "Complete Logbook",
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === "/dashboard" ? pathname === path : pathname.startsWith(path)
    )?.[1] ?? "OJT Logbook";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-surface-200 shrink-0">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: Hamburger ☰ + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-bold text-surface-900">OJT Logbook</span>
              <span className="text-[10px] text-surface-500 font-medium hidden sm:block">{pageTitle}</span>
            </div>
          </Link>
        </div>

        {/* Right: Sign Out */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-surface-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
