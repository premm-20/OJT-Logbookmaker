import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import { getAuthState, type AuthState } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let state: AuthState = { status: "signed-out" };
  try {
    state = await getAuthState();
  } catch (err) {
    // If the account lookup fails (e.g. database unreachable), still show the
    // sign-in pages rather than an error screen.
    console.error("[auth layout] Could not resolve session:", err);
  }

  if (state.status === "ready") redirect("/dashboard");
  // Signed in to Neon but the logbook account isn't usable yet.
  if (state.status !== "signed-out") redirect("/onboarding");

  return <AuthShell>{children}</AuthShell>;
}
