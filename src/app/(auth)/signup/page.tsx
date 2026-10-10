"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { isUniversityEmail, normalizeEmail, PASSWORD_MIN_LENGTH } from "@/lib/auth/config";
import { cn } from "@/lib/utils";
import { Divider, Field, FormAlert, PasswordField, SubmitButton } from "@/components/auth/fields";
import GoogleButton from "@/components/auth/google-button";
import VerifyEmailStep from "@/components/auth/verify-email-step";
import { goTo, neonCall, neonErrorMessage, pendingMobile, postJson } from "@/components/auth/auth-client";

type FieldName = "name" | "email" | "mobile" | "password";

export default function SignupPage() {
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // True when Neon signed the user in without sending a code (verification
  // not required in the Neon console), so the app sends one itself.
  const [sendCodeOnVerify, setSendCodeOnVerify] = useState(false);

  const cleanEmail = normalizeEmail(email);

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

  async function handleDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validateDetails()) return;
    setSubmitting(true);

    // 1. University domain + mobile number checks (this app's rules).
    const check = await postJson("/api/account/check", { email: cleanEmail, mobile });
    if (!check.ok) {
      setSubmitting(false);
      if (check.data.field === "email" || check.data.field === "mobile") {
        setFieldErrors({ [check.data.field]: check.data.error });
      } else {
        setError(check.data.error || "Couldn't check your details.");
      }
      return;
    }

    // 2. Create the account in Neon Auth.
    const { data, error: signUpError } = await neonCall(() =>
      authClient.signUp.email({
        name: name.trim().replace(/\s+/g, " "),
        email: cleanEmail,
        password,
      })
    );
    setSubmitting(false);
    if (signUpError) {
      setError(neonErrorMessage(signUpError, "Couldn't create your account."));
      return;
    }

    pendingMobile.set(mobile);
    if (data?.user?.emailVerified) {
      await finishSetup();
      return;
    }
    setSendCodeOnVerify(Boolean(data?.token));
    setStep("verify");
  }

  // 3. Make sure there's a session, then attach the mobile number.
  async function finishSetup() {
    const session = await neonCall(() => authClient.getSession());
    if (!session.data?.session) {
      const { error: signInError } = await neonCall(() => authClient.signIn.email({ email: cleanEmail, password }));
      if (signInError) throw new Error(neonErrorMessage(signInError, "Email verified. Please sign in."));
    }
    const onboard = await postJson("/api/account/onboard", { mobile, name: name.trim() });
    if (!onboard.ok) {
      // The account exists; onboarding will ask for the mobile number again.
      goTo("/onboarding");
      return;
    }
    pendingMobile.clear();
    goTo("/dashboard");
  }

  const clearFieldError = (field: FieldName) => {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (error) setError("");
  };

  return (
    <div>
      <StepIndicator step={step === "details" ? 1 : 2} />

      {step === "verify" ? (
        <VerifyEmailStep
          key="verify"
          email={cleanEmail}
          sendOnMount={sendCodeOnVerify}
          onVerified={finishSetup}
          onBack={() => setStep("details")}
          backLabel="Edit details"
        />
      ) : (
        <div key="details" className="animate-fade-in">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">
            Create your account
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
            Use your university email. We&apos;ll send a code to confirm it&apos;s you.
          </p>

          <div className="mt-8">
            <GoogleButton label="Sign up with Google" next="/dashboard" onError={setError} />
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

            <SubmitButton loading={submitting} loadingLabel="Creating your account">
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
