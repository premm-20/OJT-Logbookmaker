"use client";

import Image from "next/image";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { clearClientIdentity } from "@/lib/auth/client-identity";
import VerifyEmailStep from "@/components/auth/verify-email-step";
import { goTo, neonCall } from "@/components/auth/auth-client";

interface Profile {
  name: string;
  email: string;
  picture: string | null;
}

type Status = "wrong-domain" | "unverified";

/** Shown when someone is signed in to Neon but can't use the logbook yet. */
export default function OnboardingSteps({ status, profile }: { status: Status; profile: Profile }) {
  if (status === "unverified") {
    return <VerifyEmailStep email={profile.email} sendOnMount onVerified={() => goTo("/dashboard")} />;
  }
  return <WrongAccount profile={profile} />;
}

function WrongAccount({ profile }: { profile: Profile }) {
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    await neonCall(() => authClient.signOut());
    clearClientIdentity();
    goTo("/login");
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
        Use your university account
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        The logbook is only for {UNIVERSITY_DOMAIN_LABEL} accounts. You signed in as:
      </p>
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-surface-100 p-3">
        {profile.picture ? (
          <Image src={profile.picture} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-sm font-semibold text-primary-800">
            {(profile.name || profile.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-surface-900">{profile.name}</p>
          <p className="truncate text-[13px] text-surface-600">{profile.email}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={switchAccount}
        className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out and switch account
      </button>
    </div>
  );
}
