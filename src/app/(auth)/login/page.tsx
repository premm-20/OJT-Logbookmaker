"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isUniversityEmail, normalizeEmail, safeNextPath } from "@/lib/auth/config";
import { Divider, Field, FormAlert, PasswordField, SubmitButton } from "@/components/auth/fields";
import GoogleButton from "@/components/auth/google-button";
import GoogleMobileStep from "@/components/auth/google-mobile-step";
import { finishAuth, postJson, type PendingGoogleSignup } from "@/components/auth/auth-client";

const EMAIL_HINT = "Use your @medhaviskillsuniversity.edu.in address.";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const next = safeNextPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingGoogle, setPendingGoogle] = useState<PendingGoogleSignup | null>(null);

  if (pendingGoogle) {
    return <GoogleMobileStep pending={pendingGoogle} next={next} onBack={() => setPendingGoogle(null)} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanEmail = normalizeEmail(email);
    if (!isUniversityEmail(cleanEmail)) {
      setEmailError(EMAIL_HINT);
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    const { ok, data } = await postJson("/api/auth/signin", { email: cleanEmail, password });
    if (ok && data.user) {
      finishAuth(data.user, next);
      return;
    }
    setSubmitting(false);
    setError(data.error || "Couldn't sign you in.");
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">Sign in</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        Welcome back. Your logbook is where you left it.
      </p>

      <div className="mt-8">
        <GoogleButton
          mode="signin"
          onSuccess={(user) => finishAuth(user, next)}
          onNeedsMobile={setPendingGoogle}
          onError={setError}
        />
      </div>

      <Divider label="or use your email" />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Field
          label="University email"
          type="email"
          autoComplete="email"
          placeholder="name@medhaviskillsuniversity.edu.in"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError("");
            setError("");
          }}
          onBlur={() => {
            const clean = normalizeEmail(email);
            if (clean && !isUniversityEmail(clean)) setEmailError(EMAIL_HINT);
          }}
          error={emailError}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          labelAside={
            <Link
              href="/forgot-password"
              className="rounded text-[13px] font-medium text-primary-700 hover:text-primary-900 hover:underline"
            >
              Forgot password?
            </Link>
          }
        />

        {error && <FormAlert>{error}</FormAlert>}

        <SubmitButton loading={submitting} loadingLabel="Signing in">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-8 text-sm text-surface-600">
        New here?{" "}
        <Link href="/signup" className="rounded font-semibold text-primary-700 hover:text-primary-900 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

function AuthFormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="skeleton h-8 w-32" />
      <div className="skeleton h-4 w-64" />
      <div className="skeleton mt-6 h-11 w-full" />
      <div className="skeleton mt-6 h-12 w-full" />
      <div className="skeleton h-12 w-full" />
      <div className="skeleton h-12 w-full" />
    </div>
  );
}
