"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath, UNIVERSITY_DOMAIN_LABEL } from "@/lib/auth/config";
import { FormAlert } from "@/components/auth/fields";
import GoogleButton from "@/components/auth/google-button";

const URL_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Please try again.",
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
  const [error, setError] = useState(URL_ERRORS[params.get("error") || ""] || "");

  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-surface-950">Sign in</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-surface-600">
        Use your university Google account ({UNIVERSITY_DOMAIN_LABEL}).
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <GoogleButton label="Sign in with Google" next={next} onError={setError} />
        {error && <FormAlert>{error}</FormAlert>}
      </div>

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
    </div>
  );
}
