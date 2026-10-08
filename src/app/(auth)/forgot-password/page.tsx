"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { isUniversityEmail, normalizeEmail, PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { Field, FormAlert, OtpField, PasswordField, SubmitButton } from "@/components/auth/fields";
import { finishAuth, postJson } from "@/components/auth/auth-client";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [debugCode, setDebugCode] = useState("");
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
    const { ok, data } = await postJson("/api/auth/otp/send", { purpose: "reset", email: cleanEmail });
    setSubmitting(false);
    if (!ok || !data.challengeToken) {
      setError(data.error || "Couldn't send the code.");
      return false;
    }
    setChallengeToken(data.challengeToken);
    setDebugCode(data.debugCode || "");
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
    const { ok, data } = await postJson("/api/auth/reset", { email: cleanEmail, otp, password, challengeToken });
    if (ok && data.user) {
      finishAuth(data.user, "/dashboard");
      return;
    }
    setSubmitting(false);
    if (data.field === "otp" || data.field === "password") setFieldErrors({ [data.field]: data.error });
    else setError(data.error || "Couldn't reset your password.");
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
            Enter the code we sent to <span className="break-all font-semibold text-surface-900">{cleanEmail}</span>.
          </p>

          {debugCode && (
            <div className="mt-6">
              <FormAlert tone="info">
                Email isn&apos;t set up on this server yet, so here&apos;s your code:{" "}
                <span className="font-mono font-semibold tracking-wider">{debugCode}</span>
              </FormAlert>
            </div>
          )}

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
