import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/auth-shell";
import { getAuthState } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (state.status === "ready") redirect("/dashboard");
  // Signed in to Neon but the logbook account isn't usable yet.
  if (state.status !== "signed-out") redirect("/onboarding");

  return <AuthShell>{children}</AuthShell>;
}
