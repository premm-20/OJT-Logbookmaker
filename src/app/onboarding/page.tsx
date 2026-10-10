import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/session";
import OnboardingSteps from "./onboarding-steps";

export const dynamic = "force-dynamic";

export const metadata = { title: "Finish setting up" };

export default async function OnboardingPage() {
  const state = await getAuthState();
  if (state.status === "signed-out") redirect("/login");
  if (state.status === "ready") redirect("/dashboard");

  const { name, email, image } = state.neonUser;
  return <OnboardingSteps status={state.status} profile={{ name, email, picture: image }} />;
}
