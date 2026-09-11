"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

// Institutional domain regex (case-insensitive)
const UNIVERSITY_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@medhaviskills(?:\.university|university)\.edu\.in$/i;

export default function LoginPage() {
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Email auto-verification states
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailCheckMessage, setEmailCheckMessage] = useState<string | null>(null);

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();
  const emailCheckTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const isEmailPatternMatch = UNIVERSITY_EMAIL_REGEX.test(cleanEmail);

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
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(clean);
    if (error) setError("");
  };

  // Step 1: Send OTP to student's Gmail
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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
      const res = await fetch("/api/auth/otp/send", {
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
        throw new Error(data.error || "Failed to dispatch verification code.");
      }

      setStep("otp");
      setResendCooldown(45); // 45 seconds cooldown
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP from student's Gmail
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
    <div className="w-full max-w-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl shadow-primary-900/10 border border-surface-200/80 p-8 sm:p-9 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-primary-500/25">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-surface-900 tracking-tight">
            {step === "details" ? "Student Sign In" : "Check Your Gmail"}
          </h2>
          <p className="text-xs text-surface-600 mt-1">
            {step === "details"
              ? "Access your official OJT Logbook workspace"
              : `A 6-digit OTP has been sent to your university inbox`}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs font-semibold text-red-700 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Details Form */}
        {step === "details" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
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
                  placeholder="e.g., Alex Johnson"
                  required
                  autoComplete="name"
                  autoFocus
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isDetailsComplete}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700 text-white font-bold text-sm hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-600/25 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Code to Gmail...</span>
                </>
              ) : (
                <>
                  <span>Send OTP to Gmail</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
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
                We sent a 6-digit verification code to:
                <br />
                <strong className="font-mono text-xs text-emerald-950">{cleanEmail}</strong>
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
                  className="w-full text-center tracking-[0.6em] text-xl font-bold py-3 pl-10 pr-4 rounded-2xl border border-surface-200 bg-surface-50 text-surface-900 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-500/15 transition-all"
                />
              </div>
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
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
                  <span>Verify & Open Dashboard</span>
                </>
              )}
            </button>

            {/* Resend & Back controls */}
            <div className="pt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setOtp("");
                  setError("");
                }}
                className="font-semibold text-surface-500 hover:text-surface-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                onClick={handleRequestOtp}
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
