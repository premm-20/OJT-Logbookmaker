"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page where students enter Name & Mobile number
    router.replace("/login");
  }, [router]);

  return null;
}
