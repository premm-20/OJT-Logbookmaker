import DashboardShell from "@/components/dashboard-shell";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/session";
import { auditLogin } from "@/lib/auth/audit";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/login");
  if (state.status !== "ready") redirect("/onboarding");

  await auditLogin(state.user, state.sessionId);

  return <DashboardShell user={state.user}>{children}</DashboardShell>;
}
