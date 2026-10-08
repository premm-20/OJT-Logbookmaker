"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { GOOGLE_CLIENT_ID } from "@/lib/auth/config";
import type { ClientUser } from "@/lib/auth/client-identity";
import { postJson, type PendingGoogleSignup } from "./auth-client";

interface GoogleIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: "popup" | "redirect";
    context?: "signin" | "signup" | "use";
    hd?: string;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

interface GoogleButtonProps {
  mode: "signin" | "signup";
  onSuccess: (user: ClientUser) => void;
  onNeedsMobile: (pending: PendingGoogleSignup) => void;
  onError: (message: string) => void;
}

/**
 * The official Google Identity Services button. Google returns a signed ID
 * token which the server verifies; the same flow covers sign in and sign up.
 */
export default function GoogleButton({ mode, onSuccess, onNeedsMobile, onError }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keep the latest handlers without re-initialising Google on every render.
  const handlers = useRef({ onSuccess, onNeedsMobile, onError });
  useEffect(() => {
    handlers.current = { onSuccess, onNeedsMobile, onError };
  }, [onSuccess, onNeedsMobile, onError]);

  const handleCredential = useCallback(async (response: { credential?: string }) => {
    if (!response.credential) {
      handlers.current.onError("Google didn't return a sign-in. Please try again.");
      return;
    }
    setBusy(true);
    const { ok, data } = await postJson("/api/auth/google", { credential: response.credential });
    if (ok && data.user) {
      handlers.current.onSuccess(data.user);
      return;
    }
    setBusy(false);
    if (ok && data.needsMobile && data.pendingToken && data.profile) {
      handlers.current.onNeedsMobile({ pendingToken: data.pendingToken, profile: data.profile });
    } else {
      handlers.current.onError(data.error || "Google sign-in failed. Please try again.");
    }
  }, []);

  useEffect(() => {
    const gsi = window.google?.accounts?.id;
    const container = containerRef.current;
    if (!scriptReady || !gsi || !container) return;

    gsi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: "popup",
      context: mode === "signup" ? "signup" : "signin",
      hd: "medhaviskillsuniversity.edu.in",
    });

    container.innerHTML = "";
    gsi.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "rectangular",
      logo_alignment: "center",
      text: mode === "signup" ? "signup_with" : "continue_with",
      width: Math.min(400, Math.max(220, Math.floor(container.clientWidth))),
    });
    setRendered(true);
  }, [scriptReady, mode, handleCredential]);

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => handlers.current.onError("Couldn't load Google sign-in. Check your connection or use email.")}
      />
      <div className="relative h-11">
        {!rendered && <div className="skeleton absolute inset-0 rounded-[4px]" aria-hidden />}
        <div ref={containerRef} className="flex h-11 w-full justify-center" aria-label="Google sign-in" />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-[4px] bg-white/90 text-sm font-medium text-surface-700">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Checking your Google account
          </div>
        )}
      </div>
    </>
  );
}
