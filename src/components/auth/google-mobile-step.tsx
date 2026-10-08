"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Field, FormAlert, SubmitButton } from "./fields";
import { finishAuth, postJson, type PendingGoogleSignup } from "./auth-client";

/** Shown once, the first time a student continues with Google. */
export default function GoogleMobileStep({
  pending,
  next,
  onBack,
}: {
  pending: PendingGoogleSignup;
  next: string;
  onBack: () => void;
}) {
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { profile } = pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mobile.length !== 10) {
      setError("Mobile number must be 10 digits.");
      return;
    }
    setError("");
    setSubmitting(true);
    const { ok, data } = await postJson("/api/auth/google/complete", {
      pendingToken: pending.pendingToken,
      mobile,
    });
    if (ok && data.user) {
      finishAuth(data.user, next);
      return;
    }
    setSubmitting(false);
    setError(data.error || "Couldn't finish sign up.");
  }

  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 mb-6 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </button>

      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
        One last detail
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        Add your mobile number. It goes on your logbook cover and keeps your entries tied to you.
      </p>

      <div className="mt-7 flex items-center gap-3 rounded-2xl bg-surface-100 p-3">
        {profile.picture ? (
          <Image
            src={profile.picture}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover"
          />
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
        <SubmitButton loading={submitting} loadingLabel="Creating your account">
          Finish sign up
        </SubmitButton>
      </form>
    </div>
  );
}
