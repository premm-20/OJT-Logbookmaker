"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { isUniversityEmail, normalizeEmail, safeNextPath } from "@/lib/auth/config";
import { Divider, Field, FormAlert, PasswordField, SubmitButton } from "@/components/auth/fields";
import GoogleButton from "@/components/auth/google-button";
import VerifyEmailStep from "@/components/auth/verify-email-step";
import { goTo, isEmailNotVerified, neonCall, neonErrorMessage } from "@/components/auth/auth-client";

const EMAIL_HINT = "Use your @medhaviskillsuniversity.edu.in address.";

const URL_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email and password.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState(URL_ERRORS[params.get("error") || ""] || "");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const cleanEmail = normalizeEmail(email);

  async function signIn() {
    const { error: signInError } = await neonCall(() => authClient.signIn.email({ email: cleanEmail, password }));
    return signInError;
  }

  if (verifying) {
    return (
      <VerifyEmailStep
        email={cleanEmail}
        sendOnMount
        backLabel="Back to sign in"
        onBack={() => setVerifying(false)}
        onVerified={async () => {
          const signInError = await signIn();
          if (signInError) throw new Error(neonErrorMessage(signInError, "Verified. Please sign in again."));
          goTo(next);
        }}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isUniversityEmail(cleanEmail)) {
      setEmailError(EMAIL_HINT);
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setSubmitting(true);
    const signInError = await signIn();
    if (!signInError) {
      // The dashboard layout sends first-time students to finish setup.
      goTo(next);
      return;
    }
    setSubmitting(false);
    if (isEmailNotVerified(signInError)) {
      setVerifying(true);
      return;
    }
    setError(neonErrorMessage(signInError, "Couldn't sign you in."));
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">Sign in</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        Welcome back. Your logbook is where you left it.
      </p>

      <div className="mt-8">
        <GoogleButton label="Continue with Google" next={next} onError={setError} />
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
            if (cleanEmail && !isUniversityEmail(cleanEmail)) setEmailError(EMAIL_HINT);
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
      <div className="skeleton mt-6 h-12 w-full" />
      <div className="skeleton mt-6 h-12 w-full" />
      <div className="skeleton h-12 w-full" />
      <div className="skeleton h-12 w-full" />
    </div>
  );
}
