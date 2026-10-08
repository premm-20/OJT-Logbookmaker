"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { isUniversityEmail, normalizeEmail, PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { cn } from "@/lib/utils";
import { Divider, Field, FormAlert, OtpField, PasswordField, SubmitButton } from "@/components/auth/fields";
import GoogleButton from "@/components/auth/google-button";
import GoogleMobileStep from "@/components/auth/google-mobile-step";
import { finishAuth, postJson, type PendingGoogleSignup } from "@/components/auth/auth-client";

type FieldName = "name" | "email" | "mobile" | "password";
const RESEND_SECONDS = 45;

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName | "otp", string>>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pendingGoogle, setPendingGoogle] = useState<PendingGoogleSignup | null>(null);

  const cleanEmail = normalizeEmail(email);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (pendingGoogle) {
    return <GoogleMobileStep pending={pendingGoogle} next="/dashboard" onBack={() => setPendingGoogle(null)} />;
  }

  function validateDetails() {
    const errors: typeof fieldErrors = {};
    if (name.trim().length < 2) errors.name = "Enter your full name as it should appear on the logbook.";
    if (!isUniversityEmail(cleanEmail)) errors.email = "Use your @medhaviskillsuniversity.edu.in address.";
    if (mobile.length !== 10) errors.mobile = "Mobile number must be 10 digits.";
    if (password.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = `Use ${PASSWORD_MIN_LENGTH} or more characters with a letter and a number.`;
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function sendCode() {
    setError("");
    setSubmitting(true);
    const { ok, data } = await postJson("/api/auth/otp/send", {
      purpose: "signup",
      name: name.trim(),
      email: cleanEmail,
      mobile,
    });
    setSubmitting(false);
    if (!ok || !data.challengeToken) {
      setError(data.error || "Couldn't send the code.");
      return false;
    }
    setChallengeToken(data.challengeToken);
    setDebugCode(data.debugCode || "");
    setCooldown(RESEND_SECONDS);
    return true;
  }

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!validateDetails()) return;
    if (await sendCode()) {
      setOtp("");
      setStep("verify");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setFieldErrors({ otp: "Enter the 6-digit code from the email." });
      return;
    }
    setFieldErrors({});
    setError("");
    setSubmitting(true);
    const { ok, data } = await postJson("/api/auth/signup", {
      name: name.trim(),
      email: cleanEmail,
      mobile,
      password,
      otp,
      challengeToken,
    });
    if (ok && data.user) {
      finishAuth(data.user, "/dashboard");
      return;
    }
    setSubmitting(false);
    if (data.field === "otp") setFieldErrors({ otp: data.error });
    else setError(data.error || "Couldn't create your account.");
  }

  const clearFieldError = (field: FieldName) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (error) setError("");
  };

  return (
    <div>
      <StepIndicator step={step === "details" ? 1 : 2} />

      {step === "details" ? (
        <div key="details" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Create your account
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            Use your university email. We&apos;ll send a code to confirm it&apos;s you.
          </p>

          <div className="mt-8">
            <GoogleButton
              mode="signup"
              onSuccess={(user) => finishAuth(user, "/dashboard")}
              onNeedsMobile={setPendingGoogle}
              onError={setError}
            />
          </div>

          <Divider label="or sign up with email" />

          <form onSubmit={handleDetails} noValidate className="flex flex-col gap-5">
            <Field
              label="Full name"
              autoComplete="name"
              placeholder="As printed on your ID card"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearFieldError("name");
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
                clearFieldError("email");
              }}
              onBlur={() => {
                if (cleanEmail && !isUniversityEmail(cleanEmail)) {
                  setFieldErrors((prev) => ({ ...prev, email: "Use your @medhaviskillsuniversity.edu.in address." }));
                }
              }}
              error={fieldErrors.email}
            />
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
                clearFieldError("mobile");
              }}
              error={fieldErrors.mobile}
            />
            <PasswordField
              label="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("password");
              }}
              error={fieldErrors.password}
              hint={<PasswordChecklist password={password} />}
            />

            {error && <FormAlert>{error}</FormAlert>}

            <SubmitButton loading={submitting} loadingLabel="Sending code">
              Continue
            </SubmitButton>
          </form>

          <p className="mt-8 text-sm text-surface-600">
            Already have an account?{" "}
            <Link href="/login" className="rounded font-semibold text-primary-700 hover:text-primary-900 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      ) : (
        <div key="verify" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Check your email
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            We sent a 6-digit code to <span className="break-all font-semibold text-surface-900">{cleanEmail}</span>. It
            expires in 15 minutes.
          </p>

          {debugCode && (
            <div className="mt-6">
              <FormAlert tone="info">
                Email isn&apos;t set up on this server yet, so here&apos;s your code:{" "}
                <span className="font-mono font-semibold tracking-wider">{debugCode}</span>
              </FormAlert>
            </div>
          )}

          <form onSubmit={handleVerify} noValidate className="mt-7 flex flex-col gap-5">
            <OtpField
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (fieldErrors.otp) setFieldErrors({});
              }}
              error={fieldErrors.otp}
            />

            {error && <FormAlert>{error}</FormAlert>}

            <SubmitButton loading={submitting} loadingLabel="Creating your account" disabled={otp.length !== 6}>
              Create account
            </SubmitButton>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setError("");
                setFieldErrors({});
              }}
              className="-ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-900"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Edit details
            </button>
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
        {step === 1 ? "Your details" : "Confirm email"}
      </span>
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= PASSWORD_MIN_LENGTH, label: `${PASSWORD_MIN_LENGTH}+ characters` },
    { ok: /[A-Za-z]/.test(password), label: "a letter" },
    { ok: /\d/.test(password), label: "a number" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn("inline-flex items-center gap-1", rule.ok ? "text-success" : "text-surface-600")}
        >
          <Check className={cn("h-3.5 w-3.5", rule.ok ? "opacity-100" : "opacity-40")} aria-hidden />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
