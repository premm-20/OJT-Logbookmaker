"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  PlusCircle,
  LayoutDashboard,
  User,
  FileEdit,
  MessageSquare,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/sidebar-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/new-entry", label: "New Entry", icon: PlusCircle },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/edit-pdf", label: "Edit PDF", icon: FileEdit },
  { href: "/dashboard/feedback", label: "Supervisor Feedback", icon: MessageSquare },
  { href: "/dashboard/logbook", label: "Complete Logbook", icon: FileText },
];



export default function Sidebar() {
  const pathname = usePathname();
  const { open, close } = useSidebar();

  return (
    <>
      {/* Dark backdrop overlay — click to close */}
      <div
        onClick={close}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      />

      {/* Slide-in drawer */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 w-[270px] bg-white flex flex-col border-r border-surface-200 shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-surface-200 flex items-center justify-between shrink-0">
          <Link href="/dashboard" onClick={close} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-surface-900 leading-tight">OJT Logbook</h1>
              <p className="text-[11px] text-surface-800/50">Maker</p>
            </div>
          </Link>

          {/* Close (X) button */}
          <button
            onClick={close}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-surface-100 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-50 text-primary-700 font-semibold"
                    : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isActive ? "text-primary-600" : "text-surface-500"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-surface-200 bg-surface-50/60 shrink-0">
          <p className="text-[11px] text-surface-400 text-center">OJT Logbook Maker · v1.0</p>
        </div>
      </aside>
    </>
  );
}
