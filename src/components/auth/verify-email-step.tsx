"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { FormAlert, OtpField, SubmitButton } from "./fields";
import { neonCall, neonErrorMessage } from "./auth-client";

const RESEND_SECONDS = 45;

/**
 * Enter the 6-digit code Neon Auth emails to confirm an address.
 * `sendOnMount` is for flows where Neon hasn't already sent one.
 */
export default function VerifyEmailStep({
  email,
  sendOnMount,
  onVerified,
  onBack,
  backLabel = "Edit details",
}: {
  email: string;
  sendOnMount: boolean;
  onVerified: () => Promise<void> | void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // A code is either already on its way from Neon or about to be sent on mount.
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  async function requestCode(): Promise<string | null> {
    const { error: sendError } = await neonCall(() =>
      authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" })
    );
    return sendError ? neonErrorMessage(sendError, "Couldn't send the code.") : null;
  }

  function showSendResult(message: string | null, resent: boolean) {
    if (message) {
      setCooldown(0);
      setError(message);
    } else if (resent) {
      setInfo("A new code is on its way.");
    }
  }

  async function resendCode() {
    setError("");
    setCooldown(RESEND_SECONDS);
    showSendResult(await requestCode(), true);
  }

  useEffect(() => {
    if (!sendOnMount) return;
    requestCode().then((message) => showSendResult(message, false));
    // Send once when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError("Enter the 6-digit code from the email.");
      return;
    }
    setError("");
    setInfo("");
    setSubmitting(true);
    const { error: verifyError } = await neonCall(() => authClient.emailOtp.verifyEmail({ email, otp }));
    if (verifyError) {
      setSubmitting(false);
      setOtpError(neonErrorMessage(verifyError, "That code didn't work."));
      return;
    }
    try {
      await onVerified();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong after verifying.");
    }
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">Check your email</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        We sent a 6-digit code to <span className="break-all font-semibold text-surface-900">{email}</span>. It
        expires in 15 minutes. Check spam if you don&apos;t see it.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-5">
        <OtpField
          value={otp}
          onChange={(value) => {
            setOtp(value);
            setOtpError("");
          }}
          error={otpError}
        />
        {info && !error && <FormAlert tone="info">{info}</FormAlert>}
        {error && <FormAlert>{error}</FormAlert>}
        <SubmitButton loading={submitting} loadingLabel="Verifying" disabled={otp.length !== 6}>
          Verify email
        </SubmitButton>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={resendCode}
          disabled={cooldown > 0 || submitting}
          className="cursor-pointer rounded-lg px-2 py-1 font-semibold text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-surface-500"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
