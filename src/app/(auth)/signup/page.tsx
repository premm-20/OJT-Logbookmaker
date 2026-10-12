"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { isUniversityEmail, normalizeEmail, UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { cn } from "@/lib/utils";
import { Field, FormAlert, SubmitButton } from "@/components/auth/fields";
import VerifyEmailStep from "@/components/auth/verify-email-step";
import { goTo, neonCall, postJson } from "@/components/auth/auth-client";

const EMAIL_HINT = `Use your ${UNIVERSITY_DOMAIN_LABEL} email.`;

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cleanEmail = normalizeEmail(email);
  const cleanName = name.trim().replace(/\s+/g, " ");

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const errors: typeof fieldErrors = {};
    if (cleanName.length < 2) errors.name = "Enter your full name as it should appear on the logbook.";
    if (!isUniversityEmail(cleanEmail)) errors.email = EMAIL_HINT;
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    const check = await postJson("/api/account/check", { email: cleanEmail });
    setSubmitting(false);
    if (!check.ok) {
      if (check.data.field === "email") setFieldErrors({ email: check.data.error });
      else setError(check.data.error || "Couldn't check your email.");
      return;
    }
    // Show the code screen straight away; it sends the email as it opens.
    setStep("code");
  }

  // Signed in with the code: save the name, then open the dashboard.
  async function finishSignup() {
    await neonCall(() => authClient.updateUser({ name: cleanName }));
    await postJson("/api/account/onboard", { name: cleanName });
    goTo("/dashboard");
  }

  return (
    <div>
      <StepIndicator step={step === "details" ? 1 : 2} />

      {step === "code" ? (
        <VerifyEmailStep
          key="code"
          email={cleanEmail}
          purpose="sign-in"
          sendOnMount
          submitLabel="Create account"
          onVerified={finishSignup}
          onBack={() => setStep("details")}
          backLabel="Edit details"
        />
      ) : (
        <div key="details" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Create your account
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            Enter your name and university email. We&apos;ll email you a code to confirm it&apos;s you.
          </p>

          <form onSubmit={handleDetails} noValidate className="mt-8 flex flex-col gap-5">
            <Field
              label="Full name"
              autoComplete="name"
              placeholder="As printed on your ID card"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
                setError("");
              }}
              error={fieldErrors.name}
            />
            <Field
              label="University email"
              type="email"
              autoComplete="email"
              placeholder="name@medhaviskillsuniversity.edu.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
                setError("");
              }}
              onBlur={() => {
                if (cleanEmail && !isUniversityEmail(cleanEmail)) {
                  setFieldErrors((prev) => ({ ...prev, email: EMAIL_HINT }));
                }
              }}
              error={fieldErrors.email}
            />

            {error && <FormAlert>{error}</FormAlert>}

            <SubmitButton loading={submitting} loadingLabel="Sending code">
              Send code
            </SubmitButton>
          </form>

          <p className="mt-8 text-sm text-surface-600">
            Already have an account?{" "}
            <Link href="/login" className="rounded font-semibold text-primary-700 hover:text-primary-900 hover:underline">
              Sign in with Google
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-8 flex items-center gap-3" aria-label={`Step ${step} of 2`}>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1 w-8 rounded-full transition-colors duration-300",
              n <= step ? "bg-primary-600" : "bg-surface-200"
            )}
          />
        ))}
      </div>
      <span className="text-[13px] font-medium text-surface-600">
        {step === 1 ? "Your details" : "Enter code"}
      </span>
    </div>
  );
}
