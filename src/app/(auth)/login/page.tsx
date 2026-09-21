"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  User,
  Phone,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Building2,
  KeyRound,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Info,
  X,
  Lock,
  Globe,
} from "lucide-react";

// Institutional domain regex (case-insensitive)
const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");

  // Email auto-verification states
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCheckMessage, setEmailCheckMessage] = useState<string | null>(null);

  // Email delivery status
  const [deliveryStatus, setDeliveryStatus] = useState<{
    configured: boolean;
    deliveryMode: string;
    message: string;
    debugCode?: string;
  } | null>(null);

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const emailCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailPatternMatch = UNIVERSITY_EMAIL_REGEX.test(cleanEmail);

  // Check URL search parameters for errors from callback
  useEffect(() => {
    const verifier = searchParams.get("neon_auth_session_verifier");
    if (verifier) {
      window.location.href = `/auth/callback?neon_auth_session_verifier=${encodeURIComponent(verifier)}`;
      return;
    }

    const errCode = searchParams.get("error");
    const msg = searchParams.get("msg");
    const attemptedEmail = searchParams.get("email");

    if (errCode === "unauthorized_domain") {
      setError(
        `Access Restricted: Only official university Google accounts (@medhaviskillsuniversity.edu.in) are permitted.${attemptedEmail ? ` You selected: ${attemptedEmail}. Please choose your university account.` : ""}`
      );
    } else if (errCode === "exchange_failed") {
      setError(`Authentication exchange failed: ${msg || "Session could not be established"}. Please try again.`);
    } else if (errCode === "access_denied") {
      setError("Google sign-in was canceled.");
    } else if (errCode) {
      setError(msg || "Authentication failed or session expired. Please sign in below.");
    }
  }, [searchParams]);

  // Auto-verify email existence & Google Workspace MX records with debounce
  useEffect(() => {
    if (!cleanEmail) {
      setEmailVerified(false);
      setEmailCheckMessage(null);
      return;
    }

    if (!isEmailPatternMatch) {
      setEmailVerified(false);
      setEmailCheckMessage(null);
      return;
    }

    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);

    emailCheckTimerRef.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const res = await fetch(
          `/api/auth/validate-email?email=${encodeURIComponent(cleanEmail)}`
        );
        const data = await res.json();
        if (data.valid) {
          setEmailVerified(true);
          setEmailCheckMessage(
            data.isGoogleWorkspace
              ? "Verified University Google Workspace Account"
              : "Verified University Email Domain"
          );
        } else {
          setEmailVerified(false);
          setEmailCheckMessage(data.error || "Domain could not be verified");
        }
      } catch {
        setEmailVerified(true);
      } finally {
        setEmailChecking(false);
      }
    }, 450);

    return () => {
      if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    };
  }, [cleanEmail, isEmailPatternMatch]);

  // Resend timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 10);
    setMobile(clean);
    if (error) setError("");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (error) setError("");
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError("");
    if (infoMessage) setInfoMessage("");
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    if (error) setError("");
  };

  // Load Google Identity Services script
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scriptId = "google-gsi-client";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogleGsi();
      };
      document.body.appendChild(script);
    } else {
      initGoogleGsi();
    }

    function initGoogleGsi() {
      // @ts-expect-error google GSI global
      if (window.google?.accounts?.id) {
        try {
          // @ts-expect-error google GSI global
          window.google.accounts.id.initialize({
            client_id:
              "516759701042-1j43chkqtgl8hf49j0cql8gf34sun3e9.apps.googleusercontent.com",
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          const btnElem = document.getElementById("google-gsi-btn-container");
          if (btnElem) {
            // @ts-expect-error google GSI global
            window.google.accounts.id.renderButton(btnElem, {
              theme: "outline",
              size: "large",
              text: "continue_with",
              shape: "pill",
              width: 320,
            });
          }
        } catch (e) {
          console.warn("[GSI] init error:", e);
        }
      }
    }
  }, []);

  async function handleGoogleCredentialResponse(response: { credential?: string }) {
    if (!response.credential) {
      setError("Failed to receive Google credentials. Please try again.");
      return;
    }
    setGoogleLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Google authentication failed.");
      }
      if (data.user) {
        localStorage.setItem("ojt_user_id", data.user.id);
        localStorage.setItem("ojt_user_name", data.user.name);
        localStorage.setItem("ojt_user_login_email", data.user.email);
        localStorage.setItem("ojt_user_mobile", data.user.mobile || "");
      }
      window.location.href = data.redirect || "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google authentication failed.";
      setError(msg);
      setGoogleLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action 1: Sign in with Google (Neon Auth / Better Auth)
  // ─────────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    setError("");
    setInfoMessage("");
    setGoogleLoading(true);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/auth/callback`,
      });
    } catch (err: unknown) {
      console.error("[Neon Auth Google Sign-in Error]:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to initiate Google sign-in via Neon Auth";
      setError(msg);
      setGoogleLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action 2: Direct Instant Portal Login (Fastest, zero wait)
  // ─────────────────────────────────────────────────────────────
  async function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your university email address.");
      return;
    }

    if (!isEmailPatternMatch) {
      setError(
        "Only official university email IDs (@medhaviskillsuniversity.edu.in) are permitted."
      );
      return;
    }

    if (mobile.length !== 10) {
      setError("Mobile number must be exactly 10 digits.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: cleanEmail,
          mobile: mobile,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in.");
      }

      const userId = data.user?.id || `usr_${mobile}`;

      try {
        localStorage.setItem("ojt_user_id", userId);
        localStorage.setItem("ojt_user_name", trimmedName);
        localStorage.setItem("ojt_user_mobile", mobile);
        localStorage.setItem("ojt_user_login_email", cleanEmail);

        const userProfileKey = `ojt_user_profile_${userId}`;
        const existingProfile =
          localStorage.getItem(userProfileKey) ||
          localStorage.getItem("ojt_user_profile");
        const parsedProfile = existingProfile ? JSON.parse(existingProfile) : {};

        const updatedProfile = {
          ...parsedProfile,
          learner_name: trimmedName,
          phone_number: mobile,
          email_id: cleanEmail,
        };

        localStorage.setItem("ojt_user_profile", JSON.stringify(updatedProfile));
        localStorage.setItem(userProfileKey, JSON.stringify(updatedProfile));
      } catch {}

      window.location.href = data.redirect || "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setError(msg);
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action 3: Send OTP to Gmail
  // ─────────────────────────────────────────────────────────────
  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError("");
    setInfoMessage("");

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your university email address.");
      return;
    }

    if (!isEmailPatternMatch) {
      setError(
        "Only official university email IDs (@medhaviskillsuniversity.edu.in) are permitted."
      );
      return;
    }

    if (mobile.length !== 10) {
      setError("Mobile number must be exactly 10 digits.");
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: trimmedName,
          email: cleanEmail,
          mobile: mobile,
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch verification code.");
      }

      setDeliveryStatus({
        configured: !!data.configured,
        deliveryMode: data.deliveryMode || "console",
        message: data.message || "",
        debugCode: data.debugCode,
      });

      if (data.challengeToken) {
        setChallengeToken(data.challengeToken);
      }

      setStep("otp");
      setResendCooldown(45); // 45 seconds cooldown
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        setError("Network request timed out. Please check your internet connection and try again.");
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Action 3: Verify OTP from Student's Gmail
  // ─────────────────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (otp.length < 6) {
      setError("Please enter the complete 6-digit OTP received in your Gmail.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: cleanEmail,
          mobile: mobile,
          otp: otp.trim(),
          challengeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed. Please check code.");
      }

      const userId = data.user?.id || `usr_${mobile}`;

      // Store in localStorage with per-user dashboard isolation
      try {
        localStorage.setItem("ojt_user_id", userId);
        localStorage.setItem("ojt_user_name", name.trim());
        localStorage.setItem("ojt_user_mobile", mobile);
        localStorage.setItem("ojt_user_login_email", cleanEmail);

        // Pre-fill profile with login email locked as learner's email
        const userProfileKey = `ojt_user_profile_${userId}`;
        const existingProfile =
          localStorage.getItem(userProfileKey) ||
          localStorage.getItem("ojt_user_profile");
        const parsedProfile = existingProfile ? JSON.parse(existingProfile) : {};

        const updatedProfile = {
          ...parsedProfile,
          learner_name: name.trim(),
          phone_number: mobile,
          email_id: cleanEmail, // strictly set to the university login email
        };

        localStorage.setItem("ojt_user_profile", JSON.stringify(updatedProfile));
        localStorage.setItem(userProfileKey, JSON.stringify(updatedProfile));
      } catch {}

      // Navigate to student dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed.";
      setError(msg);
      setLoading(false);
    }
  }

  const isDetailsComplete =
    name.trim().length >= 2 && isEmailPatternMatch && mobile.length === 10;

  return (
    <div className="w-full max-w-md animate-fade-in relative">

      {/* Main Login Card */}
      <div className="bg-white rounded-3xl shadow-2xl shadow-primary-900/10 border border-surface-200/80 p-8 sm:p-9 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary-500/25">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-surface-900 tracking-tight">
            Student Portal Login
          </h2>
          <p className="text-xs text-surface-600 mt-1">
            Official On-the-Job Training (OJT) Logbook System
          </p>
        </div>

        {/* 2-Step Tab Navigation */}
        <div className="flex rounded-2xl bg-surface-100 p-1 mb-5 border border-surface-200">
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setError("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              step === "details"
                ? "bg-white text-surface-900 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-primary-600" />
            <span>1. Request Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("otp");
              setError("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              step === "otp"
                ? "bg-white text-surface-900 shadow-sm"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Enter 6-Digit OTP</span>
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex flex-col gap-1.5 text-xs font-semibold text-red-700 animate-shake">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {step === "details" && cleanEmail && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep("otp");
                }}
                className="text-left text-xs font-bold text-primary-700 hover:text-primary-900 underline mt-1 cursor-pointer pl-6.5"
              >
                Already received your code in Gmail? Click here to enter OTP &rarr;
              </button>
            )}
          </div>
        )}

        {/* Info/Notice notification */}
        {infoMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs font-semibold text-blue-800 animate-fade-in">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* STEP 1: Details & Google Sign-In */}
        {step === "details" && (
          <div className="space-y-5">
            {/* 1-Click Official Google Sign-In */}
            <div>
              <div id="google-gsi-btn-container" className="flex justify-center mb-1" />
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full py-3 px-4 rounded-2xl border border-surface-300 bg-white hover:bg-surface-50 text-surface-800 font-bold text-sm flex items-center justify-center gap-3 shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
              <p className="text-[11px] text-center text-surface-500 mt-1.5">
                Official Google Workspace Single Sign-On
              </p>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-surface-200" />
              <span className="flex-shrink mx-3 text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                Or Sign In with University Email
              </span>
              <div className="flex-grow border-t border-surface-200" />
            </div>

            {/* University Email Registration / Sign In Form */}
            <form onSubmit={handleDirectLogin} className="space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-surface-800 uppercase tracking-wider mb-1.5">
                  Full Name / Learner Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="e.g., Prem Singh"
                    required
                    autoComplete="name"
                    className="w-full pl-10.5 pr-4 py-2.5 rounded-2xl border border-surface-200 bg-surface-50/70 text-sm font-semibold text-surface-900 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15 placeholder:text-surface-400 transition-all"
                  />
                </div>
              </div>

              {/* University Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="email" className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
                    University Gmail ID
                  </label>
                  <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary-100">
                    <Building2 className="w-2.5 h-2.5" />
                    @medhaviskillsuniversity.edu.in
                  </span>
                </div>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="student.name@medhaviskillsuniversity.edu.in"
                    required
                    autoComplete="email"
                    className={`w-full pl-10.5 pr-10 py-2.5 rounded-2xl border text-sm font-medium transition-all ${
                      email && !isEmailPatternMatch
                        ? "border-amber-300 bg-amber-50/40 text-surface-900 focus:border-amber-500 focus:ring-amber-500/15"
                        : emailVerified
                        ? "border-emerald-400 bg-emerald-50/30 text-surface-900 focus:border-emerald-500 focus:ring-emerald-500/15"
                        : "border-surface-200 bg-surface-50/70 text-surface-900 focus:border-primary-500 focus:ring-primary-500/15"
                    } focus:bg-white focus:outline-none focus:ring-3 placeholder:text-surface-400`}
                  />
                  {emailChecking && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 animate-spin" />
                  )}
                  {!emailChecking && emailVerified && (
                    <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-fade-in" />
                  )}
                </div>

                {/* Auto-verification status chip */}
                {emailCheckMessage && (
                  <p
                    className={`text-[11px] mt-1 pl-1 font-semibold flex items-center gap-1 animate-fade-in ${
                      emailVerified ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {emailVerified ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                    )}
                    <span>{emailCheckMessage}</span>
                  </p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="mobile" className="block text-xs font-bold text-surface-800 uppercase tracking-wider">
                    Mobile Number
                  </label>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      mobile.length === 10
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-surface-100 text-surface-500"
                    }`}
                  >
                    {mobile.length}/10 digits
                  </span>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1 text-xs font-bold text-surface-500 select-none border-r border-surface-200 pr-2">
                    <Phone className="w-3.5 h-3.5 text-primary-600" />
                    <span>+91</span>
                  </div>
                  <input
                    id="mobile"
                    type="tel"
                    value={mobile}
                    onChange={handleMobileChange}
                    placeholder="9876543210"
                    required
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    className="w-full pl-18 pr-10 py-2.5 rounded-2xl border border-surface-200 bg-surface-50/70 text-sm font-bold text-surface-900 tracking-wider focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15 placeholder:text-surface-400 placeholder:font-normal placeholder:tracking-normal transition-all"
                  />
                  {mobile.length === 10 && (
                    <CheckCircle2 className="absolute right-3.5 w-4 h-4 text-emerald-500 animate-fade-in" />
                  )}
                </div>
              </div>

              {/* Primary Action: Direct Portal Sign In */}
              <button
                type="submit"
                disabled={loading || !isDetailsComplete}
                className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700 text-white font-bold text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing into Portal...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Student Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Secondary Options */}
              <div className="flex items-center justify-between pt-1 px-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleRequestOtp()}
                  disabled={loading || !cleanEmail}
                  className="font-semibold text-surface-600 hover:text-primary-700 underline transition-colors cursor-pointer"
                >
                  Send OTP to Gmail &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep("otp");
                  }}
                  className="font-bold text-emerald-700 hover:text-emerald-900 underline transition-colors cursor-pointer"
                >
                  Enter OTP Code &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: OTP Verification Screen */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
            {/* Inbox Notice Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verification Email Dispatched</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Check your university Gmail inbox:
                <br />
                <strong className="font-mono text-xs text-emerald-950">
                  {cleanEmail || "student.name@medhaviskillsuniversity.edu.in"}
                </strong>
              </p>
              <p className="text-[11px] text-emerald-800 bg-emerald-100/60 p-2 rounded-xl font-medium">
                💡 <strong>Instant Login:</strong> Click <strong>"Confirm email address"</strong> inside the email in your Gmail to login with 1 click, or enter the code below.
              </p>
              <div className="pt-1 flex items-center justify-between border-t border-emerald-200/60">
                <span className="text-[10px] text-emerald-600">Check inbox or spam folder</span>
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  <span>Open Gmail</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Email Input for OTP confirmation */}
            <div>
              <label htmlFor="otp-email" className="block text-xs font-bold text-surface-800 uppercase tracking-wider mb-1.5">
                University Gmail ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  id="otp-email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="student.name@medhaviskillsuniversity.edu.in"
                  required
                  className="w-full pl-10.5 pr-4 py-2.5 rounded-2xl border border-surface-200 bg-surface-50 text-sm font-semibold text-surface-900 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15"
                />
              </div>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-xs font-bold text-surface-800 uppercase tracking-wider mb-2 text-center">
                Enter 6-Digit OTP Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="• • • • • •"
                  maxLength={6}
                  required
                  autoFocus
                  inputMode="numeric"
                  className="w-full text-center tracking-[0.6em] text-xl font-bold py-3 pl-10 pr-4 rounded-2xl border border-surface-200 bg-surface-50 text-surface-900 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-3 focus:ring-emerald-500/15 transition-all"
                />
              </div>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.length !== 6 || !cleanEmail}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-700 text-white font-bold text-sm hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify & Access Portal</span>
                </>
              )}
            </button>

            {/* Resend & Back controls */}
            <div className="pt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setError("");
                }}
                className="font-semibold text-surface-500 hover:text-surface-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Registration Details</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestOtp()}
                disabled={loading || resendCooldown > 0}
                className="font-bold text-primary-700 hover:text-primary-800 disabled:text-surface-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend Code"}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* Privacy note */}
        <div className="mt-5 pt-4 border-t border-surface-200/80 flex items-center justify-center gap-2 text-xs text-surface-500 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Only authorized university students can access this logbook</span>
        </div>
      </div>
    </div>
  );
}
