import DashboardShell from "@/components/dashboard-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const ojtSession = cookieStore.get("ojt_session")?.value;

  if (!ojtSession) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
