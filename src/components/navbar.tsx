"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, Menu } from "lucide-react";
import BrandMark from "@/components/brand-mark";
import UserAvatar from "@/components/user-avatar";
import { clearClientIdentity, type ClientUser } from "@/lib/auth/client-identity";
import { authClient } from "@/lib/auth/client";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/new-entry": "New entry",
  "/dashboard/profile": "Profile",
  "/dashboard/edit-pdf": "Edit PDF",
  "/dashboard/feedback": "Supervisor feedback",
  "/dashboard/logbook": "Complete logbook",
};

interface NavbarProps {
  user: ClientUser;
  onMenuClick?: () => void;
}

export default function Navbar({ user, onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === "/dashboard" ? pathname === path : pathname.startsWith(path)
    )?.[1] ?? "OJT Logbook";

  async function handleLogout() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } catch {}
    clearClientIdentity();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-surface-200 bg-white/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onMenuClick}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-surface-600 hover:bg-surface-100 hover:text-surface-900"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/dashboard" className="flex min-w-0 items-center gap-3 rounded-xl">
            <BrandMark compact />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-sm font-semibold text-surface-950">OJT Logbook</span>
              <span className="hidden truncate text-xs text-surface-600 sm:block">{pageTitle}</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-1.5 hover:bg-surface-100 sm:pr-3"
            title="Your profile"
            aria-label={`Your profile: ${user.name}`}
          >
            <UserAvatar user={user} size={32} />
            <span className="hidden max-w-[16ch] flex-col leading-tight md:flex">
              <span className="truncate text-[13px] font-semibold text-surface-900">{user.name}</span>
              <span className="truncate text-xs text-surface-600">{user.email.split("@")[0]}</span>
            </span>
          </Link>

          <button
            onClick={handleLogout}
            disabled={signingOut}
            aria-label="Sign out"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900 disabled:opacity-60"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
