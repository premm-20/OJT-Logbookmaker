"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { clearClientIdentity } from "@/lib/auth/client-identity";
import { Field, FormAlert, SubmitButton } from "@/components/auth/fields";
import VerifyEmailStep from "@/components/auth/verify-email-step";
import { goTo, neonCall, pendingMobile, postJson } from "@/components/auth/auth-client";

interface Profile {
  name: string;
  email: string;
  picture: string | null;
}

type Status = "wrong-domain" | "unverified" | "needs-mobile";

export default function OnboardingSteps({ status, profile }: { status: Status; profile: Profile }) {
  if (status === "unverified") {
    return (
      <VerifyEmailStep
        email={profile.email}
        sendOnMount
        onVerified={() => goTo("/onboarding")}
      />
    );
  }
  if (status === "wrong-domain") return <WrongAccount profile={profile} />;
  return <MobileStep profile={profile} />;
}

async function signOutAndGo(path: string) {
  await neonCall(() => authClient.signOut());
  clearClientIdentity();
  goTo(path);
}

function AccountChip({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-100 p-3">
      {profile.picture ? (
        <Image src={profile.picture} alt="" width={40} height={40} className="h-10 w-10 rounded-xl object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-sm font-semibold text-primary-800">
          {profile.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-surface-900">{profile.name}</p>
        <p className="truncate text-[13px] text-surface-600">{profile.email}</p>
      </div>
    </div>
  );
}

function WrongAccount({ profile }: { profile: Profile }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
        Use your university account
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        The logbook is only for {UNIVERSITY_DOMAIN_LABEL} accounts. You signed in as:
      </p>
      <div className="mt-6">
        <AccountChip profile={profile} />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signOutAndGo("/login");
        }}
        className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 text-[15px] font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Sign out and switch account
      </button>
    </div>
  );
}

const noopSubscribe = () => () => {};

function MobileStep({ profile }: { profile: Profile }) {
  // Prefill the number typed at sign up (kept in sessionStorage) without a hydration mismatch.
  const stored = useSyncExternalStore(noopSubscribe, pendingMobile.get, () => "");
  const [typed, setTyped] = useState<string | null>(null);
  const mobile = typed ?? stored;
  const setMobile = setTyped;
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mobile.length !== 10) {
      setError("Mobile number must be 10 digits.");
      return;
    }
    setError("");
    setSubmitting(true);
    const { ok, data } = await postJson("/api/account/onboard", { mobile });
    if (ok && data.user) {
      pendingMobile.clear();
      goTo("/dashboard");
      return;
    }
    setSubmitting(false);
    setError(data.error || "Couldn't finish setting up your account.");
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">One last detail</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        Add your mobile number. It goes on your logbook cover and keeps your entries tied to you.
      </p>

      <div className="mt-7">
        <AccountChip profile={profile} />
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
        <Field
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          leading="+91"
          value={mobile}
          onChange={(e) => {
            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
            if (error) setError("");
          }}
          autoFocus
        />
        {error && <FormAlert>{error}</FormAlert>}
        <SubmitButton loading={submitting} loadingLabel="Setting up your logbook">
          Continue to dashboard
        </SubmitButton>
      </form>

      <button
        type="button"
        onClick={() => void signOutAndGo("/login")}
        className="mt-6 -ml-2 cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
      >
        Not you? Sign out
      </button>
    </div>
  );
}
