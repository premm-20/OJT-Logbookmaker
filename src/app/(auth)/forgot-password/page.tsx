"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { isUniversityEmail, normalizeEmail, PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { Field, FormAlert, OtpField, PasswordField, SubmitButton } from "@/components/auth/fields";
import { goTo, neonCall, neonErrorMessage } from "@/components/auth/auth-client";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; otp?: string; password?: string }>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cleanEmail = normalizeEmail(email);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setError("");
    setSubmitting(true);
    const { error: sendError } = await neonCall(() => authClient.forgetPassword.emailOtp({ email: cleanEmail }));
    setSubmitting(false);
    if (sendError) {
      setError(neonErrorMessage(sendError, "Couldn't send the code."));
      return false;
    }
    setCooldown(45);
    return true;
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!isUniversityEmail(cleanEmail)) {
      setFieldErrors({ email: "Use your @medhaviskillsuniversity.edu.in address." });
      return;
    }
    if (await sendCode()) setStep("reset");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (otp.length !== 6) errors.otp = "Enter the 6-digit code from the email.";
    if (password.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = `Use ${PASSWORD_MIN_LENGTH} or more characters with a letter and a number.`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setError("");
    setSubmitting(true);
    const { error: resetError } = await neonCall(() => authClient.emailOtp.resetPassword({ email: cleanEmail, otp, password }));
    if (resetError) {
      setSubmitting(false);
      const message = neonErrorMessage(resetError, "Couldn't reset your password.");
      if (/code|otp|expired|too many/i.test(message)) setFieldErrors({ otp: message });
      else setError(message);
      return;
    }

    const { error: signInError } = await neonCall(() => authClient.signIn.email({ email: cleanEmail, password }));
    if (signInError) {
      goTo("/login");
      return;
    }
    goTo("/dashboard");
  }

  return (
    <div>
      <Link
        href="/login"
        className="-ml-2 mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to sign in
      </Link>

      {step === "email" ? (
        <div key="email" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Reset your password
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            Enter the email you signed up with and we&apos;ll send you a code.
          </p>
          <form onSubmit={handleEmail} noValidate className="mt-8 flex flex-col gap-5">
            <Field
              label="University email"
              type="email"
              autoComplete="email"
              placeholder="name@medhaviskillsuniversity.edu.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors({});
                setError("");
              }}
              error={fieldErrors.email}
              autoFocus
            />
            {error && <FormAlert>{error}</FormAlert>}
            <SubmitButton loading={submitting} loadingLabel="Sending code">
              Send code
            </SubmitButton>
          </form>
        </div>
      ) : (
        <div key="reset" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Choose a new password
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            If an account uses <span className="break-all font-semibold text-surface-900">{cleanEmail}</span>, a
            6-digit code is on its way. Check spam if you don&apos;t see it.
          </p>

          <form onSubmit={handleReset} noValidate className="mt-7 flex flex-col gap-5">
            <OtpField
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setFieldErrors((prev) => ({ ...prev, otp: undefined }));
              }}
              error={fieldErrors.otp}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={fieldErrors.password}
              hint={`${PASSWORD_MIN_LENGTH}+ characters, with a letter and a number.`}
            />
            {error && <FormAlert>{error}</FormAlert>}
            <SubmitButton loading={submitting} loadingLabel="Saving">
              Save and sign in
            </SubmitButton>
          </form>

          <div className="mt-6 flex justify-end text-sm">
            <button
              type="button"
              onClick={sendCode}
              disabled={cooldown > 0 || submitting}
              className="cursor-pointer rounded-lg px-2 py-1 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-surface-500"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
