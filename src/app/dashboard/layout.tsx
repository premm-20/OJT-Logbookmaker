import DashboardShell from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const ojtSession = cookieStore.get("ojt_session")?.value;

  let hasUser = !!ojtSession;
  if (!hasUser) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      hasUser = !!user;
    } catch {}
  }

  if (!hasUser) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
